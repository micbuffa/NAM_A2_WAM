#!/usr/bin/env python3
"""Offline round-trip verification of graph lowering; never a native WebNN claim."""
import json,pathlib,onnx,numpy as np,onnxruntime as ort,time,gc
from onnx import helper,numpy_helper
ROOT=pathlib.Path(__file__).resolve().parents[1];D=ROOT/'examples/wam/source-separation/model-assets/direct-webnn';types={'float32':np.dtype('float32'),'int32':np.dtype('int32'),'int64':np.dtype('int64'),'uint8':np.dtype('uint8'),'float16':np.dtype('float16')}
def rebuild(key):
 g=json.loads((D/(key+'.graph.json')).read_text());w=np.memmap(D/(key+'.weights.bin'),dtype='uint8',mode='r');initial=[];nodes=[];count=0
 for name,c in g['constants'].items():initial.append(numpy_helper.from_array(np.ndarray(c['shape'],dtype=types[c['dataType']],buffer=w,offset=c['offset']),name))
 def constant(values,dtype='int64'):
  nonlocal count
  count+=1;name='arg'+str(count);initial.append(numpy_helper.from_array(np.array(values,dtype=dtype),name));return name
 names={name:d['id']for name,d in g['inputs'].items()}
 for name,c in g['inputs'].items():nodes.append(helper.make_node('Identity',[name],[c['id']]))
 for row in g['operations']:
  op=row['op'];args=list(row['args']);o=row.get('options',{});attrs={};out=row['outputs']
  if op in ['add','sub','mul','div','matmul','erf','sigmoid','sqrt','neg','tanh']:oname={'matmul':'MatMul'}.get(op,op.capitalize())
  elif op=='reshape':oname='Reshape';args[1]=constant(args[1])
  elif op=='transpose':oname='Transpose';attrs={'perm':o['permutation']}
  elif op=='gemm':
   oname='Gemm';attrs={k:o[k]for k in ['alpha','beta']if k in o};attrs.update(transA=int(o.get('aTranspose',False)),transB=int(o.get('bTranspose',False)))
   if 'c'in o:args.append(o['c']['operand'])
  elif op in ['conv2d','convTranspose2d']:
   oname='Conv'if op=='conv2d'else'ConvTranspose';p=o['padding'];attrs={'pads':[p[0],p[2],p[1],p[3]],'strides':o['strides'],'dilations':o['dilations'],'group':o['groups']}
   if 'outputPadding'in o:attrs['output_padding']=o['outputPadding']
   if 'bias'in o:args.append(o['bias']['operand'])
  elif op in ['instanceNormalization','layerNormalization']:
   oname='InstanceNormalization'if op=='instanceNormalization'else'LayerNormalization';args +=[o['scale']['operand'],o['bias']['operand']];attrs={'epsilon':o['epsilon']}
   if op=='layerNormalization':attrs['axis']=o['axes'][0]
  elif op in ['reduceMean','reduceL2']:oname='ReduceMean'if op=='reduceMean'else'ReduceL2';attrs={'axes':o['axes'],'keepdims':int(o['keepDimensions'])}
  elif op=='softmax':oname='Softmax';attrs={'axis':args.pop()}
  elif op=='gather':oname='Gather';attrs={'axis':o['axis']}
  elif op=='split':oname='Split';args[1]=constant(args[1]);attrs={'axis':o['axis']}
  elif op=='slice':
   oname='Slice';start,size=args[1:];args=[args[0],constant(start),constant([a+b for a,b in zip(start,size)]),constant(list(range(len(start)))),constant(o['strides'])]
  elif op=='concat':oname='Concat';attrs={'axis':args[1]};args=args[0]
  elif op=='expand':oname='Expand';args[1]=constant(args[1])
  elif op=='clamp':oname='Clip';args +=[constant(o['minValue'],'float32')if'minValue'in o else'',constant(o['maxValue'],'float32')if'maxValue'in o else'']
  elif op=='pad':oname='Pad';args=[args[0],constant(args[1]+args[2]),constant(o['value'],'float32')];attrs={'mode':o['mode']}
  else:raise ValueError(op)
  nodes.append(helper.make_node(oname,args,out,**attrs))
 for name,d in g['outputs'].items():nodes.append(helper.make_node('Identity',[d['id']],[name]))
 def info(pair):name,d=pair;return helper.make_tensor_value_info(name,helper.np_dtype_to_tensor_dtype(types[d['dataType']]),d['shape'])
 model=helper.make_model(helper.make_graph(nodes,key,[info(x)for x in g['inputs'].items()],[info(x)for x in g['outputs'].items()],initial),opset_imports=[helper.make_opsetid('',17)],ir_version=9)
 onnx.checker.check_model(model);path=pathlib.Path('/tmp/'+key+'-webnn-roundtrip.onnx');onnx.save(model,path);return path,g
for key,source in [('demucs4',ROOT/'third_party/nam-webgpu-probe/htdemucs-core.onnx'),('roformer6',ROOT/'examples/wam/source-separation/model-assets/bs_roformer_sw_6stem_fp16.onnx')]:
 start=time.time();path,g=rebuild(key);gc.collect();print(key,'roundtrip graph built',time.time()-start,flush=True)
 rng=np.random.default_rng(20261030);feeds={name:(rng.standard_normal(d['shape'])*.01).astype('float32')for name,d in g['inputs'].items()};outputs=[]
 for label,p in [('original',source),('lowered',path)]:
  opts=ort.SessionOptions();opts.intra_op_num_threads=2;session=ort.InferenceSession(str(p),opts,providers=['CPUExecutionProvider']);t=time.time();out=session.run(None,feeds);outputs.append(out);del session;gc.collect();print(key,label,'processing',time.time()-t,flush=True)
 errs=[]
 for a,b in zip(*outputs):
  delta=a.astype('float64')-b;err={'maxAbsolute':float(np.abs(delta).max()),'relativeRms':float(np.linalg.norm(delta.ravel())/max(np.linalg.norm(a.ravel()),1e-30))};errs.append(err)
 result={'model':key,'method':'WebNN recipe reconstructed as ONNX for offline numerical lowering verification; NOT native WebNN validation','seed':20261030,'input':'independent float32 standard normal * .01; full fixed neural-core input tensors; not audio quality','outputs':errs,'passed':all(e['maxAbsolute']<.005 and e['relativeRms']<.01 for e in errs)}
 pathlib.Path('/tmp/'+key+'-direct-lowering-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
