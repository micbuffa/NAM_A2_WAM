"""Bounded SCNet audit, not a production adapter. Requires prepared third_party/scnet-probe.
Run with a Python environment containing torch, numpy, onnxruntime, PyYAML; ffmpeg on PATH.
The exporter and checkpoint preparation/provenance are documented in MODEL_CANDIDATES.md.
No corpus audio or checkpoint is redistributed. All timings below are native CPU only.
"""
import hashlib, importlib.util, json, pathlib, platform, subprocess, time
import numpy as np
import torch
import onnxruntime as ort
ROOT=pathlib.Path(__file__).resolve().parent.parent
P=ROOT/'third_party/scnet-probe'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert digest(P/'scnet.int8.onnx')=='98228931494151762a1c4ab1ec7899a894b1f81fd4a509921a9d2f9bacc50845'
assert digest(P/'scnet_checkpoint_musdb18.ckpt')=='1bc0d1abb20bfdf966dcd07637bafd03e4bc13653d09ef18bc9b3e342eafe2aa'
spec=importlib.util.spec_from_file_location('scnet_export',P/'export-scnet.py');ex=importlib.util.module_from_spec(spec);spec.loader.exec_module(ex)
spec=importlib.util.spec_from_file_location('scnet_reference',P/'reference.py');ref=importlib.util.module_from_spec(spec);spec.loader.exec_module(ref)
torch.set_num_threads(2)
model=ex.load(P,'scnet')
options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
session=ort.InferenceSession(str(P/'scnet.int8.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
def read(path):
 b=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ar','44100','-ac','2','pipe:1'])
 return np.frombuffer(b,dtype='<f4').reshape(-1,2).T.copy()
def metrics(reference,estimate):
 r=reference.astype(np.float64).ravel();r-=r.mean();e=estimate.astype(np.float64).ravel();e-=e.mean();energy=np.sum(r*r);a=np.sum(r*e)/energy
 return {'siSdrDb':float(10*np.log10(max(a*a*energy,1e-20)/max(np.sum((e-a*r)**2),1e-20))),'snrDb':float(10*np.log10(energy/max(np.sum((e-r)**2),1e-20))),'gainDb':float(20*np.log10(max(abs(a),1e-6)))}
manifest=json.loads((ROOT/'test-data/source-separation/manifest.json').read_text());runs=[]
for case in manifest['cases']:
 if case['target']!='bass' and case['id']!='medley-rainfall-20':continue
 audio={}
 for role in ['mix','reference']:
  file=ROOT/'test-data/source-separation'/case['files'][role]['path'];assert digest(file)==case['files'][role]['sha256'];audio[role]=read(file)
 mix=audio['mix'];mono=mix.astype(np.float64).mean(0);std=mono.std(ddof=1)+1e-8
 x=((mix-mono.mean())/std).astype(np.float32);n=x.shape[-1];segment=np.pad(x,((0,0),(0,ex.SEGMENT-n)),mode='reflect' if n>ex.SEGMENT//2 else 'constant')
 with torch.no_grad():
  t=time.perf_counter();native=model(torch.from_numpy(segment[None]))[0].numpy()[:,:,:n]*std;native_seconds=time.perf_counter()-t
  spectrum,pad=ex.stft(model,torch.from_numpy(segment[None]));t=time.perf_counter();out=session.run(None,{'mix_spec':spectrum.numpy()})[0];inference=time.perf_counter()-t
  got=ex.istft(model,torch.from_numpy(out),pad)[0].numpy()[:,:,:n]*std
 assert np.isfinite(got).all()
 role='bass' if case['target']=='bass' else 'other';target=model.sources.index(role)
 run={'case':case['id'],'target':case['target'],'outputRole':role,'guitarProxy':role=='other','frames':n,'inputSha256':case['files']['mix']['sha256'],'nativeSeconds':native_seconds,'onnxNetworkSeconds':inference,'nativeScore':metrics(audio['reference'],native[target]),'compactOnnxScore':metrics(audio['reference'],got[target]),'baseline':metrics(audio['reference'],mix),'compactToNative':{name:metrics(native[i],got[i]) for i,name in enumerate(model.sources)}};runs.append(run);print(json.dumps(run),flush=True)
 if len(runs)==1:
  spectrum.numpy().astype('<f4').tofile(P/'browser-input.f32');out.astype('<f4').tofile(P/'browser-reference.f32')
report={'protocol':'scnet-candidate-audit-v1','date':'2026-10-25','status':'native-cpu-candidate-only','model':'audiojs/scnet int8; NOT SCNet XL or Large','modelSha256':digest(P/'scnet.int8.onnx'),'checkpointSha256':digest(P/'scnet_checkpoint_musdb18.ckpt'),'python':platform.python_version(),'platform':platform.platform(),'torch':torch.__version__,'onnxruntime':ort.__version__,'threads':2,'roles':model.sources,'segmentFrames':ex.SEGMENT,'hopFrames':1024,'fft':4096,'window':'rectangular','normalization':'mono mean/std ddof1; no DC added to any stem','shortInputPadding':'right reflect if > half segment, otherwise zeros','browserInputSha256':digest(P/'browser-input.f32'),'browserReferenceSha256':digest(P/'browser-reference.f32'),'codeHashes':{str(p.relative_to(P)):digest(p) for p in [P/'export-scnet.py',P/'reference.py',P/'scnet_code/scnet/scnet.py',P/'scnet_code/scnet/separation.py']},'runs':runs,'limitations':['Single compact ONNX candidate; no musical quality ranking from random spectra.','Native PyTorch timings are not browser WASM or WebGPU timings.','Guitar other proxy only in Rainfall, as defined in existing Q2 corpus.','No human listening scores, no original independent recordings.']}
out=ROOT/'examples/wam/source-separation/benchmarks/scnet-native-candidate-2026-10-25.json';out.write_text(json.dumps(report,indent=2)+'\n');print(out,flush=True)
