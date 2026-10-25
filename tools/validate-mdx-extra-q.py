"""Bounded native MDX Extra Q experiment; not an ONNX/browser adapter.
Requires the existing demucs research environment + diffq 0.2.4.
Official Meta checkpoints use the legacy torch serialization format. Enable
TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1 ONLY for this official model-loading experiment.
No MUSDB test score is produced: that split was used to train this ensemble.
"""
import os,json,time,pathlib,hashlib,subprocess,platform
import torch,numpy as np
from demucs.pretrained import get_model
from demucs.apply import apply_model
root=pathlib.Path(__file__).resolve().parent.parent
cache=pathlib.Path('/private/tmp/nam-mdx-probe-cache');cache.mkdir(exist_ok=True);torch.hub.set_dir(str(cache));torch.set_num_threads(2)
report={'date':'2026-10-25','model':'mdx_extra_q','protocol':'mdx-extra-q-native-feasibility-v1','torch':torch.__version__,'python':platform.python_version(),'platform':platform.platform(),'threads':2,'trainingContamination':'Official documentation says mdx_extra uses MUSDB test. Not an independent MUSDB test evaluation. Additional training provenance on MedleyDB is unknown.','status':'failed'}
try:
 t=time.perf_counter();model=get_model('mdx_extra_q').eval().cpu();report.update(models=len(model.models),roles=model.sources,sampleRate=model.samplerate,officialSegmentsSeconds=[float(m.segment) for m in model.models],loadSeconds=time.perf_counter()-t)
 report['checkpoints']=[{'filename':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((cache/'checkpoints').glob('*.th'))]
 manifest=json.loads((root/'test-data/source-separation/manifest.json').read_text());case=next(c for c in manifest['cases'] if c['id']=='medley-rainfall-20');files={}
 for role in ['mix','reference']:
  p=root/'test-data/source-separation'/case['files'][role]['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==case['files'][role]['sha256'];b=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ar','44100','-ac','2','pipe:1']);files[role]=np.frombuffer(b,dtype='<f4').reshape(-1,2).T.copy()
 x=torch.from_numpy(files['mix']);mono=x.mean(0);mean,std=mono.mean(),mono.std();t=time.perf_counter()
 with torch.no_grad():y=(apply_model(model,((x-mean)/std)[None],shifts=0,split=False,device='cpu')[0]*std+mean).numpy()
 report.update(inferenceSeconds=time.perf_counter()-t,shape=list(y.shape),finite=bool(np.isfinite(y).all()),case=case['id'],inputSha256=case['files']['mix']['sha256'],settings={'shifts':0,'split':False,'seconds':x.shape[-1]/44100,'note':'One bounded whole-excerpt inference; no 44-second chunked whole-song throughput claim.'})
 assert report['finite'] and y.shape==(4,2,264600)
 r=files['reference'].astype(np.float64).ravel();r-=r.mean();e=y[model.sources.index('other')].astype(np.float64).ravel();e-=e.mean();energy=np.sum(r*r);a=np.sum(r*e)/energy
 report['guitarOtherProxy']={'siSdrDb':float(10*np.log10(a*a*energy/max(np.sum((e-a*r)**2),1e-20))),'gainDb':float(20*np.log10(abs(a))),'independentTrainingExposure':False};report['status']='native-completed-browser-unported'
except Exception as error:report['error']=str(error);report['exception']=type(error).__name__
p=root/'examples/wam/source-separation/benchmarks/mdx-extra-q-native-2026-10-25.json';p.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
