import torch,numpy as np,json,time,sys
from pathlib import Path
from demucs.pretrained import get_model
from fractions import Fraction
torch.set_num_threads(2);torch.hub.set_dir('/private/tmp/nam-latency-model-cache');torch.backends.mha.set_fastpath_enabled(False)
m=get_model('htdemucs').models[0].eval().cpu()
for child in m.modules():
 if hasattr(child,'sin_random_shift'):child.sin_random_shift=0
seconds=float(sys.argv[1]) if len(sys.argv)>1 else 1
assert seconds in [1,2], 'Validation supports 1s and 2s probes'
window=round(seconds*44100);stride=44100 if seconds==2 else 33075
frames=6*44100
input=np.fromfile('third_party/nam-latency-probe/music-input.f32',dtype='<f4').reshape(-1,2).T.copy()
x=torch.from_numpy(input[None]);
# Reference true 1s windows, 25% overlap, same hold-back/linear fade as JS.
outputs=np.zeros((4,2,frames),dtype=np.float32);tail=None;start=0;plans=[];m.use_train_segment=False
t=time.time()
with torch.no_grad():
 while start<frames:
  end=min(frames,start+window);final=end==frames;commit=end-start if final else stride
  part=x[:,:,start:end]
  # Match applyInference's central zero padding on final incomplete window.
  L=part.shape[-1];delta=window-L;part=torch.nn.functional.pad(part,(delta//2,delta-delta//2))
  out=m(part)[0].numpy()[:,:,delta//2:delta//2+L].copy()
  if tail is not None:
   w=np.linspace(0,1,tail.shape[-1],dtype=np.float32)
   out[:,:,:len(w)]=tail*(1-w)+out[:,:,:len(w)]*w
  tail=None if final else out[:,:,commit:].copy();outputs[:,:,start:start+commit]=out[:,:,:commit]
  plans.append({'start':start,'end':end,'commitFrames':commit});start+=commit
shortSeconds=time.time()-t
import onnxruntime as ort
options=ort.SessionOptions();options.intra_op_num_threads=2
session=ort.InferenceSession(f'third_party/nam-latency-probe/htdemucs-{seconds:g}s-core.onnx',sess_options=options,providers=['CPUExecutionProvider'])
with torch.no_grad():
 first=x[:,:,:window];spec=m._magnitude(m._spec(first));native_first=m(first)[0].numpy()
 a,b=session.run(None,{'mix':first.numpy(),'spec':spec.numpy()})
 restored=(m._ispec(m._mask(None,torch.from_numpy(a)),window)+torch.from_numpy(b))[0].numpy()
cpu_audio_parity=[]
for i,role in enumerate(m.sources):
 delta=restored[i]-native_first[i]
 cpu_audio_parity.append({'role':role,'maxAbsError':float(np.max(np.abs(delta))),'relativeRmsError':float(np.sqrt(np.sum(delta**2)/max(np.sum(native_first[i]**2),1e-30)))})
if start!=frames or not np.isfinite(outputs).all():raise RuntimeError('Invalid assembled short audio')
if any(c['maxAbsError']>1e-3 or c['relativeRmsError']>1e-3 for c in cpu_audio_parity):raise RuntimeError('CPU reconstructed audio parity failed')
outputs.tofile(f'third_party/nam-latency-probe/music-reference-{seconds:g}s.f32')
m.use_train_segment=True;m.segment=Fraction(39,5)
with torch.no_grad():full=m(x)[0].numpy()
full.tofile('third_party/nam-latency-probe/music-reference-7.8s.f32')
report={'frames':frames,'sampleRate':44100,'windowSeconds':seconds,'shortReferenceSeconds':shortSeconds,'plans':plans,'cpuAudioParity':cpu_audio_parity,'differenceToFullContext':[]}
for i,role in enumerate(m.sources):
 ref=full[i];out=outputs[i];delta=out-ref
 report['differenceToFullContext'].append({'role':role,'relativeRmsError':float(np.sqrt(np.sum(delta**2)/max(np.sum(ref**2),1e-30))),'maxAbsError':float(np.max(np.abs(delta))),'rmsShort':float(np.sqrt(np.mean(out**2))),'rmsFull':float(np.sqrt(np.mean(ref**2)))})
# Produce paired, equally scaled WAV files for listening; no per-stem normalization.
import wave
for variant,stems in [('short',outputs),('reference',full)]:
 for i,role in enumerate(m.sources):
  with wave.open(f'third_party/nam-latency-probe/{variant}-{seconds:g}s-{role}.wav','wb') as wav:
   wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(44100)
   wav.writeframes(np.rint(np.clip(stems[i].T*.6,-1,1)*32767).astype('<i2').tobytes())
Path(f'/tmp/nam-latency-musical-reference-{seconds:g}s.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
