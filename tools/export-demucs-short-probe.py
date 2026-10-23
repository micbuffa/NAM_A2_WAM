# Probe only. Transform installed MIT-licensed Meta Demucs forward to expose
# the real-valued neural core, keeping its original layer implementation.
import torch,onnx,numpy as np,onnxruntime as ort,inspect,textwrap,ast,types,json,time,sys
from pathlib import Path
from demucs.pretrained import get_model
import demucs.htdemucs as ht
seconds=float(sys.argv[1]);assert seconds in [1,2,4], 'Allowed probe windows: 1, 2 or 4 seconds';N=round(seconds*44100)
torch.set_num_threads(2);torch.hub.set_dir('/private/tmp/nam-latency-model-cache')
Path('third_party/nam-latency-probe').mkdir(parents=True,exist_ok=True)
model=get_model('htdemucs').models[0].cpu().eval();model.use_train_segment=False
# Deterministic export: both PyTorch reference and exported model share shift0.
torch.backends.mha.set_fastpath_enabled(False)
for m in model.modules():
 if hasattr(m,'sin_random_shift'):m.sin_random_shift=0
original_forward=model.forward
module=ast.parse(textwrap.dedent(inspect.getsource(ht.HTDemucs.forward)));fn=module.body[0]
fn.args.args.append(ast.arg(arg='mag'))
body=[]
for node in fn.body:
 if isinstance(node,ast.Assign):
  names=[getattr(t,'id',None) for t in node.targets]
  if 'z' in names or 'mag' in names:continue
  if 'x_is_mps' in names:break
 body.append(node)
body+=ast.parse('xt=xt.view(B,S,-1,length)\nxt=xt*stdt[:,None]+meant[:,None]\nreturn x,xt').body
fn.body=body
ns=dict(ht.__dict__);exec(compile(ast.fix_missing_locations(module),'<demucs-core>','exec'),ns)
class Core(torch.nn.Module):
 def __init__(self,m):super().__init__();self.m=m
 def forward(self,mix,spec):return ns['forward'](self.m,mix,spec)
core=Core(model).eval();torch.manual_seed(123)
mix=torch.randn(1,2,N)*.05
with torch.no_grad():
 spec=model._magnitude(model._spec(mix));native=original_forward(mix);x,xt=core(mix,spec)
 joined=model._ispec(model._mask(None,x),N)+xt
 print('core-native max',float((native-joined).abs().max()),'spec',spec.shape,flush=True)
out=Path(f'third_party/nam-latency-probe/htdemucs-{seconds:g}s-core.onnx')
t=time.time()
with torch.no_grad():torch.onnx.export(core,(mix,spec),str(out),input_names=['mix','spec'],output_names=['outX','outXt'],opset_version=17,dynamo=False)
print('exported',out,'secs',time.time()-t,flush=True)
opts=ort.SessionOptions();opts.intra_op_num_threads=2
s=ort.InferenceSession(str(out),sess_options=opts,providers=['CPUExecutionProvider'])
t=time.time();a,b=s.run(None,{'mix':mix.numpy(),'spec':spec.numpy()});elapsed=time.time()-t
comparison=[]
for ref,got in [(x.numpy(),a),(xt.numpy(),b)]:comparison.append({'maxAbsError':float(np.max(np.abs(ref-got))),'relativeRmsError':float(np.sqrt(np.sum((ref-got)**2)/np.sum(ref**2)))})
np.savez(f'/tmp/nam-latency-{seconds:g}s-reference.npz',mix=mix.numpy(),spec=spec.numpy(),outX=x.numpy(),outXt=xt.numpy(),native=native.numpy())
import hashlib
if any(c['maxAbsError']>1e-3 or c['relativeRmsError']>1e-3 for c in comparison):raise RuntimeError('CPU ONNX core parity failed')
report={'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'seconds':seconds,'frames':N,'specShape':list(spec.shape),'torchVersion':torch.__version__,'onnxruntimeVersion':ort.__version__,'cpuElapsedSeconds':elapsed,'comparison':comparison,'coreReconstructionMaxError':float((native-joined).abs().max()),'modelFile':str(out)}
Path(f'/tmp/nam-latency-{seconds:g}s-export.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
