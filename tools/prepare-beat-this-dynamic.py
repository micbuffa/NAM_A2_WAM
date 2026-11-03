#!/usr/bin/env python3
"""Export final0 for real short-window lengths and build a weight-free reconstruction recipe.
Requires beat-this==1.1.0, torch, onnx, numpy. No downloads. Recipe copies all tensor
payloads from the pinned cached model; only graph/shape metadata is shipped.
"""
import argparse,base64,hashlib,json,types
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=Path,required=True);p.add_argument('--checkpoint',type=Path,required=True)
p.add_argument('--model-output',type=Path,required=True)
p.add_argument('--recipe-output',type=Path,default=Path('examples/wam/projects/tempo/beat-this-dynamic-recipe.json'))
a=p.parse_args()
import numpy as np,torch,onnx
from onnx import helper,TensorProto,numpy_helper
from beat_this.inference import load_model
SOURCE_SHA='1337dc6c21257ed6b803418efc320df42b5d8eb296ef16648ef60457cd4b9e55'
CHECKPOINT_SHA='8c328b45f59d8dd3dff219253ff6a8d6482be57d0133a29140e2febbf8eb8331'
def digest(b):return hashlib.sha256(b).hexdigest()
source=a.source.read_bytes()
if digest(source)!=SOURCE_SHA or digest(a.checkpoint.read_bytes())!=CHECKPOINT_SHA:raise ValueError('Unpinned source/checkpoint')
torch.set_num_threads(4)
model=load_model(str(a.checkpoint));bounded=[]
# Time attention has32 batch-heads in each frontend block,16 in the main layers.
# Splitting that independent dimension limits any scores tensor to8*T*T floats.
for name,module in model.named_modules():
 if module.__class__.__name__!='Attend' or ('.attnT.' not in name and not name.startswith('transformer_blocks.layers.')):continue
 total=32 if '.attnT.' in name else 16
 def forward(self,q,k,v,total=total):
  shape=q.shape;t=q.shape[-2];d=q.shape[-1]
  if self.scale is not None:q=q*(self.scale/(d**-.5))
  q=q.reshape(total,t,d);k=k.reshape(total,t,d);v=v.reshape(total,t,d)
  out=[torch.nn.functional.scaled_dot_product_attention(q[i:i+8],k[i:i+8],v[i:i+8],dropout_p=0.0) for i in range(0,total,8)]
  return torch.cat(out,dim=0).reshape(shape)
 module.forward=types.MethodType(forward,module);bounded.append(name)
if len(bounded)!=9:raise ValueError(f'Unexpected time attention count {len(bounded)}')
class Export(torch.nn.Module):
 def __init__(self,model):super().__init__();self.model=model
 def forward(self,spect):
  y=self.model(spect);return y['beat'],y['downbeat']
with torch.no_grad():torch.onnx.export(Export(model),torch.zeros(1,613,128),str(a.model_output),input_names=['spect'],output_names=['beat','downbeat'],opset_version=17,dynamic_axes={'spect':{1:'frames'},'beat':{1:'frames'},'downbeat':{1:'frames'}},dynamo=False)
m=onnx.load(a.model_output);original=onnx.ModelProto.FromString(source)
by_hash={digest(t.raw_data):t for t in original.graph.initializer if t.raw_data}
reused=[]
for tensor in m.graph.initializer:
 if not tensor.raw_data or digest(tensor.raw_data) in by_hash:continue
 # Batchnorm folding differs by a few ULPs between export versions; reuse the
 # exact already-published folded Conv values, never ship another copy of weights.
 if not tensor.name.startswith('onnx::Conv'):raise ValueError(f'Unmatched tensor {tensor.name}')
 array=numpy_helper.to_array(tensor)
 candidates=[(float(np.max(np.abs(numpy_helper.to_array(t)-array))),t)for t in original.graph.initializer if list(t.dims)==list(tensor.dims) and t.data_type==tensor.data_type]
 error,match=min(candidates,key=lambda pair:pair[0])
 if error>1e-6:raise ValueError('Folded conv differs materially')
 name=tensor.name;tensor.CopyFrom(match);tensor.name=name
 reused.append({'target':name,'source':match.name,'maxAbsFromFreshFold':error})
constants={n.output[0]:numpy_helper.to_array(helper.get_attribute_value(n.attribute[0])) for n in m.graph.node if n.op_type=='Constant' and len(n.attribute)==1 and n.attribute[0].name=='value'}
nodes=[];reductions=0;splits=0
for n in m.graph.node:
 if n.op_type=='ReduceL2':
  reductions+=1;prefix=n.name+'/safe_l2';attrs={v.name:helper.get_attribute_value(v)for v in n.attribute};axes=attrs.pop('axes',None);inputs=[prefix+'/square']
  if axes is not None:
   nodes.append(helper.make_node('Constant',[],[prefix+'/axes'],name=prefix+'/Axes',value=helper.make_tensor(prefix+'/axes_value',TensorProto.INT64,[len(axes)],axes)));inputs.append(prefix+'/axes')
  nodes.extend([helper.make_node('Mul',[n.input[0],n.input[0]],[prefix+'/square'],name=prefix+'/Square'),helper.make_node('ReduceSum',inputs,[prefix+'/sum'],name=prefix+'/Sum',**attrs),helper.make_node('Sqrt',[prefix+'/sum'],list(n.output),name=prefix+'/Sqrt')])
 elif n.op_type=='Split':
  splits+=1;axis=next(helper.get_attribute_value(v)for v in n.attribute if v.name=='axis');sizes=constants.get(n.input[1])
  if sizes is None or len(sizes)!=len(n.output):raise ValueError('Nonconstant split sizes')
  start=0
  for i,(size,out)in enumerate(zip(sizes,n.output)):
   inputs=[n.input[0]];prefix=n.name+f'/slice{i}'
   for key,value in [('start',start),('end',start+int(size)),('axis',axis)]:
    name=prefix+'/'+key;nodes.append(helper.make_node('Constant',[],[name],name=name,value=helper.make_tensor(name+'_value',TensorProto.INT64,[1],[value])));inputs.append(name)
   nodes.append(helper.make_node('Slice',inputs,[out],name=prefix));start+=int(size)
 else:nodes.append(n)
if reductions!=25 or splits!=37:raise ValueError('Unexpected normalization/split count')
del m.graph.node[:];m.graph.node.extend(nodes);onnx.checker.check_model(m);target=m.SerializeToString();a.model_output.write_bytes(target)
def read(data,pos):
 value=0;shift=0
 while pos<len(data) and shift<64:
  b=data[pos];pos+=1;value|=(b&127)<<shift
  if b<128:return value,pos
  shift+=7
 raise ValueError('Invalid varint')
def fields(data,start,end):
 pos=start
 while pos<end:
  tag,pos=read(data,pos);wire=tag&7
  if wire==2:size,pos=read(data,pos);payload=pos;pos+=size
  elif wire==0:payload=pos;_,pos=read(data,pos)
  elif wire in [1,5]:payload=pos;pos+=8 if wire==1 else 4
  else:raise ValueError('Unsupported wire')
  if pos>end:raise ValueError('Truncated field')
  yield tag>>3,wire,payload,pos
# Locate protobuf raw_data ranges, with no learned values in the JSON recipe.
def payloads(data):
 graph=next(f for f in fields(data,0,len(data))if f[0]==7 and f[1]==2)
 for number,wire,start,end in fields(data,graph[2],graph[3]):
  if number==5 and wire==2:
   for f,w,s,e in fields(data,start,end):
    if f==9 and w==2:yield s,e
ranges={digest(source[s:e]):(s,e-s)for s,e in payloads(source)}
parts=[];cursor=0;copied=0
for start,end in payloads(target):
 match=ranges.get(digest(target[start:end]))
 if match is None:raise ValueError('Would embed tensor payload in recipe')
 if start>cursor:parts.append({'data':base64.b64encode(target[cursor:start]).decode()})
 parts.append({'offset':match[0],'length':match[1]});copied+=match[1];cursor=end
if cursor<len(target):parts.append({'data':base64.b64encode(target[cursor:]).decode()})
recipe={'version':1,'id':'beat-this-final0-dynamic-safe-v1','sourceSha256':SOURCE_SHA,'sourceSize':len(source),'targetSha256':digest(target),'targetSize':len(target),'copiedTensorBytes':copied,'literalBytes':len(target)-copied,'boundedTimeAttention':bounded,'reusedFoldedConvolutions':reused,'frames':{'min':14,'max':1500},'parts':parts}
a.recipe_output.write_text(json.dumps(recipe,separators=(',',':'))+'\n')
print(json.dumps({'recipeSha256':digest(a.recipe_output.read_bytes()),'recipeSize':a.recipe_output.stat().st_size,'targetSha256':digest(target),'targetSize':len(target),'copiedTensorBytes':copied,'literalBytes':len(target)-copied},indent=2))
