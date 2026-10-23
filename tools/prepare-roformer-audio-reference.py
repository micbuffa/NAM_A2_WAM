"""Create local browser fixtures: supplied PyTorch reference and musical ORT-CPU + torch DSP.
No native studio stems are claimed. Run in the temporary Demucs export environment.
"""
from pathlib import Path
import json,time
import numpy as np
import torch,onnxruntime as ort
root=Path('third_party/bs-roformer-audit');torch.set_num_threads(2)
ref=np.load(root/'reference.npz',allow_pickle=False)
ref['input_audio'].astype('<f4').tofile(root/'reference-input.f32')
ref['ref_audio'].astype('<f4').tofile(root/'reference-audio.f32')
ref['spec_real'].astype('<f4').tofile(root/'reference-spec-real.f32')
ref['spec_imag'].astype('<f4').tofile(root/'reference-spec-imag.f32')
# Same public CC-BY musical excerpt already used by the low-latency benchmark.
music=np.fromfile('third_party/nam-latency-probe/music-input.f32',dtype='<f4').reshape(-1,2).T.copy()
assert music.shape==(2,264600)
music.astype('<f4').tofile(root/'music-input.f32')
opts=ort.SessionOptions();opts.intra_op_num_threads=2
session=ort.InferenceSession(str(root/'bs_roformer_sw_6stem_fp16.onnx'),sess_options=opts,providers=['CPUExecutionProvider'])
output=np.zeros((12,music.shape[1]),np.float32);tail=None;start=0;blocks=[];window=torch.hann_window(2048)
while start<music.shape[1]:
 end=min(start+176400,music.shape[1]);length=end-start;final=end==music.shape[1];commit=length if final else 132300
 padded=np.zeros((1,2,176400),np.float32);padded[0,:,:length]=music[:,start:end]
 t=time.perf_counter();s=torch.stft(torch.from_numpy(padded.reshape(2,-1)),2048,512,window=window,center=True,return_complex=True).reshape(1,2,1025,345)
 real,imag=session.run(None,{'spec_real':s.real.numpy(),'spec_imag':s.imag.numpy()})
 pcm=torch.istft(torch.complex(torch.from_numpy(real),torch.from_numpy(imag)).reshape(12,1025,345),2048,512,window=window,center=True,length=176400).numpy()[:,:length].copy()
 if tail is not None:
  n=tail.shape[1];w=np.linspace(0,1,n,dtype=np.float32);pcm[:,:n]=tail*(1-w)+pcm[:,:n]*w
 tail=None if final else pcm[:,commit:].copy();output[:,start:start+commit]=pcm[:,:commit];blocks.append({'start':start,'frames':length,'commit':commit,'elapsedMs':(time.perf_counter()-t)*1000});start+=commit
output.astype('<f4').tofile(root/'music-reference.f32')
(root/'audio-reference.json').write_text(json.dumps({'frames':music.shape[1],'sampleRate':44100,'blocks':blocks,'scope':'musical reference = pinned FP16 ORT CPU + torch STFT/iSTFT; random input uses supplied original PyTorch ref_audio'},indent=2))
print((root/'audio-reference.json').read_text(),flush=True)
