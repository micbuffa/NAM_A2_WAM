#!/usr/bin/env python3
"""Offline only: pinned ONNX checkpoints -> WebNN calls + raw typed constants.
No ONNX parser, ORT or WASM neural fallback is used by the browser consumer.
Requires Python3.12, onnx1.20.0, onnxruntime1.22.0, numpy.
"""
import argparse,collections,hashlib,json,pathlib,tempfile
import numpy as np
import onnx,onnxruntime as ort
from onnx import helper,numpy_helper,TensorProto
ROOT=pathlib.Path(__file__).resolve().parents[1]
MODELS={
 'demucs4':('third_party/nam-webgpu-probe/htdemucs-core.onnx','da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748'),
 'roformer6':('examples/wam/source-separation/model-assets/bs_roformer_sw_6stem_fp16.onnx','d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444')}
DTYPES={1:'float32',6:'int32',7:'int64',9:'uint8',10:'float16'}
def sha(data):return hashlib.sha256(data).hexdigest()
class Lowerer:
 def __init__(self,m,static_scalar_gather_slices=False):
  self.static_scalar_gather_slices=static_scalar_gather_slices
  self.m=m;self.arrays={t.name:numpy_helper.to_array(t)for t in m.graph.initializer};self.meta={t.name:{'dataType':DTYPES[t.type.tensor_type.elem_type],'shape':[d.dim_value if d.HasField('dim_value') else None for d in t.type.tensor_type.shape.dim]}for t in [*m.graph.input,*m.graph.value_info,*m.graph.output]};self.values={};self.constants={};self.constant_views={};self.ops=[];self.extra=0
  for t in m.graph.initializer:self.meta[t.name]={'dataType':DTYPES[t.data_type],'shape':list(t.dims)}
  for i,t in enumerate(m.graph.input):self.values[t.name]=f'i{i}'
 def control(self,n,i,default=None):
  if i>=len(n.input)or not n.input[i]:return default
  if n.input[i]not in self.arrays:raise ValueError(f'Nonconstant control: {n.name}/{i}')
  return self.arrays[n.input[i]].reshape(-1).tolist()
 def value(self,name):
  if not name:return None
  if name in self.values:return self.values[name]
  if name not in self.arrays:raise ValueError('Unavailable input '+name)
  a=self.arrays[name];key='c'+str(len(self.constants));self.constants[key]=a;self.values[name]=key;return key
 def emit(self,op,args,options=None,shape=None,dtype='float32',outputs=1):
  keys=['v'+str(self.extra+i)for i in range(outputs)];self.extra+=outputs
  row={'op':op,'args':args,'outputs':keys}
  if options:row['options']=options
  if shape is not None:row['checkShape']=shape
  self.ops.append(row);return keys[0]if outputs==1 else keys
 def reshape(self,x,shape):
  # Native Core ML need not specialize reshapes of static convolution filters.
  # Fold all constant-only views offline; dynamic activations remain WebNN ops.
  if x in self.constants:
   cache=(x,tuple(shape))
   if cache not in self.constant_views:
    key='c'+str(len(self.constants));self.constants[key]=self.constants[x].reshape(shape);self.constant_views[cache]=key
   return self.constant_views[cache]
  return self.emit('reshape',[x,shape],shape=shape)
 def lower(self,n):
  a={v.name:helper.get_attribute_value(v)for v in n.attribute};op=n.op_type;shape=list(self.meta[n.output[0]]['shape']);src=self.meta[n.input[0]]['shape'];rank=len(src);get=lambda i:self.value(n.input[i])if i<len(n.input)and n.input[i]else None
  axis=lambda v,r=rank:int(v)%r
  if op in ['Add','Sub','Mul','Div','MatMul']:out=self.emit({'MatMul':'matmul'}.get(op,op.lower()),[get(0),get(1)])
  elif op in ['Erf','Sigmoid','Sqrt','Neg','Tanh']:out=self.emit(op.lower(),[get(0)])
  elif op in ['Reshape','Squeeze','Unsqueeze']:
   if any(x is None for x in shape):raise ValueError('Unknown reshape '+n.name)
   out=None if 0 in shape else self.reshape(get(0),shape)
  elif op=='Transpose':out=self.emit('transpose',[get(0)],{'permutation':a.get('perm',list(reversed(range(rank))))})
  elif op=='Gemm':
   opts={k:a[k]for k in ['alpha','beta']if k in a};opts.update(aTranspose=bool(a.get('transA',0)),bTranspose=bool(a.get('transB',0)))
   if get(2)is not None:opts['c']={'operand':get(2)}
   out=self.emit('gemm',[get(0),get(1)],opts)
  elif op in ['Conv','ConvTranspose']:
   if a.get('auto_pad',b'NOTSET')not in [b'NOTSET',b'']:raise ValueError('Auto padding unsupported')
   dims=len(a['kernel_shape']);x,w=get(0),get(1)
   if dims==1:x=self.reshape(x,[src[0],src[1],1,src[2]]);ws=self.meta[n.input[1]]['shape'];w=self.reshape(w,[ws[0],ws[1],1,ws[2]])
   p=a.get('pads',[0]*(2*dims));opts={'inputLayout':'nchw','filterLayout':'iohw'if op=='ConvTranspose'else'oihw','groups':a.get('group',1),'strides':[1,*a.get('strides',[1])]if dims==1 else a.get('strides',[1,1]),'dilations':[1,*a.get('dilations',[1])]if dims==1 else a.get('dilations',[1,1]),'padding':[0,0,p[0],p[1]]if dims==1 else[p[0],p[2],p[1],p[3]]}
   if get(2)is not None:opts['bias']={'operand':get(2)}
   if op=='ConvTranspose'and'output_padding'in a:opts['outputPadding']=[0,*a['output_padding']]if dims==1 else a['output_padding']
   out=self.emit('convTranspose2d'if op=='ConvTranspose'else'conv2d',[x,w],opts)
   if dims==1:out=self.reshape(out,shape)
  elif op=='InstanceNormalization':
   if rank!=3:raise ValueError('Unexpected normalization rank')
   out=self.reshape(get(0),[src[0],src[1],1,src[2]])
   out=self.emit('instanceNormalization',[out],{'scale':{'operand':get(1)},'bias':{'operand':get(2)},'epsilon':a.get('epsilon',1e-5),'layout':'nchw'})
   out=self.reshape(out,shape)
  elif op=='LayerNormalization':out=self.emit('layerNormalization',[get(0)],{'axes':list(range(axis(a.get('axis',-1)),rank)),'scale':{'operand':get(1)},'bias':{'operand':get(2)},'epsilon':a.get('epsilon',1e-5)})
  elif op in ['ReduceMean','ReduceL2']:
   axes=self.control(n,1,a.get('axes',list(range(rank))));out=self.emit('reduceMean'if op=='ReduceMean'else'reduceL2',[get(0)],{'axes':[axis(v)for v in axes],'keepDimensions':bool(a.get('keepdims',1))})
  elif op=='Softmax':out=self.emit('softmax',[get(0),axis(a.get('axis',-1))])
  elif op=='Gather':
   arr=self.arrays[n.input[1]];ax=axis(a.get('axis',0));arr=np.where(arr<0,arr+src[ax],arr).astype('int32');key='c'+str(len(self.constants));self.constants[key]=arr
   if self.static_scalar_gather_slices and arr.ndim==0:
    # Equivalent static selection without a native scalar gather -> reshape chain.
    # Canary Core ML compiles that gather alone but fails after the next reshape.
    index=int(arr)
    if not 0<=index<src[ax]:raise ValueError('Scalar gather index out of bounds: '+n.name)
    starts=[0]*rank;sizes=list(src);starts[ax]=index;sizes[ax]=1
    out=self.emit('slice',[get(0),starts,sizes],{'strides':[1]*rank},shape=sizes)
    self.ops[-1]['sourceLabel']=(n.name or 'Gather')+'/static-selection-slice'
    out=self.reshape(out,shape)
   else:out=self.emit('gather',[get(0),key],{'axis':ax})
  elif op=='Split':
   sizes=self.control(n,1,a.get('split'));sizes=sizes or[self.meta[o]['shape'][axis(a.get('axis',0))]for o in n.output]
   out=self.emit('split',[get(0),sizes],{'axis':axis(a.get('axis',0))},outputs=len(n.output))
  elif op=='Slice':
   starts=[0]*rank;sizes=list(src);steps=[1]*rank
   begin,end=self.control(n,1),self.control(n,2);axes=self.control(n,3,list(range(len(begin))));strides=self.control(n,4,[1]*len(begin))
   for lo,hi,ax,step in zip(begin,end,axes,strides):
    ax=axis(ax)
    if step<1:raise ValueError('Negative slice step unsupported')
    lo,hi,step=slice(lo,hi,step).indices(src[ax]);starts[ax]=lo;sizes[ax]=max(0,hi-lo);steps[ax]=step
   shape=[(size+step-1)//step for size,step in zip(sizes,steps)]
   out=None if 0 in shape else self.emit('slice',[get(0),starts,sizes],{'strides':steps},shape=shape)
  elif op=='Concat':
   inputs=[get(i)for i in range(len(n.input))if 0 not in self.meta[n.input[i]]['shape']];out=inputs[0]if len(inputs)==1 else self.emit('concat',[inputs,axis(a.get('axis',0))])
   shape=list(src);shape[axis(a.get('axis',0))]=sum(self.meta[x]['shape'][axis(a.get('axis',0))]for x in n.input)
  elif op=='Expand':out=self.emit('expand',[get(0),self.control(n,1)])
  elif op=='Clip':
   low=self.control(n,1);high=self.control(n,2);opts={}
   if low:opts['minValue']=low[0]
   if high:opts['maxValue']=high[0]
   out=self.emit('clamp',[get(0)],opts)
  elif op=='Pad':
   pads=self.control(n,1);opts={'mode':a.get('mode',b'constant').decode()};v=self.control(n,2,[0]);opts['value']=v[0];out=self.emit('pad',[get(0),pads[:rank],pads[rank:]],opts)
  elif op=='Einsum':
   eq=a['equation'].decode().replace(' ','');x,y=get(0),get(1)
   if eq=='bhid,bhjd->bhij':y=self.emit('transpose',[y],{'permutation':[0,1,3,2]})
   elif eq!='bhij,bhjd->bhid':raise ValueError('Unsupported equation '+eq)
   out=self.emit('matmul',[x,y])
  else:raise ValueError('Unsupported '+op+' at '+n.name)
  values=out if isinstance(out,list)else[out]
  if len(values)!=len(n.output):raise ValueError('Output mismatch '+n.name)
  for name,v in zip(n.output,values):self.values[name]=v
  self.meta[n.output[0]]['shape']=shape
  if self.ops:self.ops[-1]['sourceLabel']=n.name or op
 def export(self):
  for n in self.m.graph.node:self.lower(n)
  used={}
  def collect(v):
   if isinstance(v,str)and v in self.constants:used[v]=self.constants[v]
   elif isinstance(v,list):
    for item in v:collect(item)
   elif isinstance(v,dict):
    for item in v.values():collect(item)
  for op in self.ops:collect(op['args']);collect(op.get('options',{}))
  blob=bytearray();constants={}
  for key,arr in used.items():
   arr=np.array(arr,copy=True,order='C');dt=DTYPES[helper.np_dtype_to_tensor_dtype(arr.dtype)];padding=(-len(blob))%8;blob.extend(b'\0'*padding);offset=len(blob);raw=arr.tobytes();blob.extend(raw);constants[key]={'dataType':dt,'shape':list(arr.shape),'offset':offset,'bytes':len(raw)}
  return {'format':'direct-webnn-graph-v1','inputNames':[t.name for t in self.m.graph.input],'outputNames':[t.name for t in self.m.graph.output],'inputs':{t.name:{**self.meta[t.name],'id':self.values[t.name]}for t in self.m.graph.input},'outputs':{t.name:{**self.meta[t.name],'id':self.values[t.name]}for t in self.m.graph.output},'constants':constants,'operations':self.ops,'requiredOperations':sorted(set(n['op']for n in self.ops))},bytes(blob)
def export_model(key,out):
 path=ROOT/MODELS[key][0];data=path.read_bytes()
 if sha(data)!=MODELS[key][1]:raise ValueError('Unpinned checkpoint '+key)
 with tempfile.TemporaryDirectory()as folder:
  folded=pathlib.Path(folder)/'folded.onnx';opts=ort.SessionOptions();opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC;opts.optimized_model_filepath=str(folded);opts.intra_op_num_threads=1
  session=ort.InferenceSession(str(path),opts,providers=['CPUExecutionProvider']);del session
  model=onnx.shape_inference.infer_shapes(onnx.load(folded),data_prop=True)
  graph,weights=Lowerer(model,static_scalar_gather_slices=key=='demucs4').export()
 graph['provenance']={'sourceSha256':sha(data),'sourceBytes':len(data),'offlineTools':{'onnx':onnx.__version__,'onnxruntime':ort.__version__,'numpy':np.__version__},'optimization':'ORT_ENABLE_BASIC offline constant folding; WebNN calls lowered ahead of time; no ONNX/ORT browser dependency','constantViews':'folded offline; no native reshape of convolution filter constants','numericalQualification':'pending direct native WebNN vs reference; do not infer parity from export success'}
 if key=='demucs4':graph['provenance']['staticScalarGather']='slice + reshape, all26 constant scalar selections; candidate for Canary gather/reshape compilation interaction, native validation pending'
 graph['weights']={'url':key+'.weights.bin','bytes':len(weights),'sha256':sha(weights)}
 out.mkdir(parents=True,exist_ok=True);(out/(key+'.weights.bin')).write_bytes(weights);raw=json.dumps(graph,separators=(',',':')).encode();(out/(key+'.graph.json')).write_bytes(raw)
 return{'graph':{'url':'./model-assets/direct-webnn/'+key+'.graph.json','bytes':len(raw),'sha256':sha(raw)},'weights':graph['weights'],'operations':len(graph['operations']),'sourceSha256':graph['provenance']['sourceSha256']}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=pathlib.Path,default=ROOT/'examples/wam/source-separation/model-assets/direct-webnn');args=parser.parse_args();index={'format':'direct-webnn-index-v1','models':{}}
 for key in MODELS:index['models'][key]=export_model(key,args.output);print(key,index['models'][key],flush=True)
 (args.output/'index.json').write_text(json.dumps(index,indent=2)+'\n')
