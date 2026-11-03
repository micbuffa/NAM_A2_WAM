#!/usr/bin/env python3
"""Explicit heavyweight gate; not part of npm test. No downloads performed.
Requires beat-this==1.1.0, torch, torchaudio, onnxruntime, numpy.
Input: mono 16-bit PCM WAV at 22050 Hz; browser must import the identical WAV.
Example: python tools/validate-beat-this.py --audio sample.wav --checkpoint final0.ckpt \
  --assets examples/wam/source-separation/model-assets/beat-this --report /tmp/reference.json
Then export the browser result and rerun with --browser /path/to/beat-this.json.
"""
import argparse, hashlib, json, time, wave
from pathlib import Path
import importlib.metadata

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--audio',type=Path,required=True)
parser.add_argument('--checkpoint',type=Path,required=True)
parser.add_argument('--assets',type=Path,required=True)
parser.add_argument('--browser',type=Path)
parser.add_argument('--dynamic-model',type=Path,help='Locally reconstructed safe dynamic graph, required to qualify real short-window context.')
parser.add_argument('--report',type=Path,required=True)
args=parser.parse_args()
import numpy as np
import torch
import onnxruntime as ort
from beat_this.inference import load_model, split_piece, aggregate_prediction
from beat_this.preprocessing import LogMelSpect
from beat_this.model.postprocessor import Postprocessor

def check(path,expected):
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    if digest!=expected:raise ValueError(f'Wrong SHA256: {path}')
    return digest
checkpoint_hash=check(args.checkpoint,'8c328b45f59d8dd3dff219253ff6a8d6482be57d0133a29140e2febbf8eb8331')
model_hash=check(args.assets/'beat_this.onnx','1337dc6c21257ed6b803418efc320df42b5d8eb296ef16648ef60457cd4b9e55')
check(args.assets/'mel-filterbank.bin','1ee975d96f44ccf2c3bfe37825c1c1f0b089f5703c7a12a84b1f0a3bce004533')
with wave.open(str(args.audio)) as w:
    if (w.getnchannels(),w.getsampwidth(),w.getframerate())!=(1,2,22050):raise ValueError('Expected mono PCM16 22050 Hz WAV.')
    pcm=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768
if len(pcm)>120*22050:raise ValueError('Qualification limit 120 s.')
torch.set_num_threads(4)
report={'audio':args.audio.name,'audioSha256':hashlib.sha256(args.audio.read_bytes()).hexdigest(),
        'pcmSha256':hashlib.sha256(pcm.tobytes()).hexdigest(),'duration':len(pcm)/22050,'sampleRate':22050,'checkpointSha256':checkpoint_hash,'modelSha256':model_hash,
        'versions':{k:importlib.metadata.version(k) for k in ['torch','torchaudio','beat-this','onnxruntime','numpy']}}
with torch.no_grad():
    frontend=LogMelSpect()
    pinned_fb=np.fromfile(args.assets/'mel-filterbank.bin',dtype='<f4').reshape(513,128)
    report['installedTorchaudioFilterbankMaxAbs']=float(np.max(np.abs(frontend.spect_class.mel_scale.fb.numpy()-pinned_fb)))
    # Qualify the exact export contract independently of installed torchaudio filterbank version.
    frontend.spect_class.mel_scale.fb.copy_(torch.from_numpy(pinned_fb))
    features=frontend(torch.from_numpy(pcm))
    features.numpy().tofile(args.report.with_suffix('.features.f32'))
    pcm.tofile(args.report.with_suffix('.pcm.f32'))
    chunks,starts=split_piece(features,1500,6)
    model=load_model(str(args.checkpoint))
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.log_severity_level=3
    use_dynamic=bool(args.dynamic_model and len(features)<1488)
    execution_model=args.dynamic_model if use_dynamic else args.assets/'beat_this.onnx'
    if use_dynamic:check(execution_model,'51c8c97f3013190b8d49d2f79dc40173f0cd4d7d4e3df598537821ae440a77cb')
    report['windowMode']='dynamic' if use_dynamic else 'fixed'
    report['executionGraphSha256']=hashlib.sha256(execution_model.read_bytes()).hexdigest()
    report['qualificationMode']='reference-length' if use_dynamic or len(features)>=1488 else 'padded-static-diagnostic'
    session=ort.InferenceSession(str(execution_model),options,providers=['CPUExecutionProvider'])
    predictions=[];torch_predictions=[];logit_errors=[]
    for chunk in chunks:
        padded=chunk[None] if use_dynamic else torch.nn.functional.pad(chunk,(0,0,0,1500-len(chunk)))[None]
        expected=model(padded)
        actual=session.run(None,{'spect':padded.numpy()})
        logit_errors.append({k:float(np.max(np.abs(expected[k].numpy()[0]-actual[i][0]))) for i,k in enumerate(['beat','downbeat'])})
        torch_predictions.append({k:expected[k][0][:len(chunk)] for k in ['beat','downbeat']})
        predictions.append({k:torch.from_numpy(actual[i][0][:len(chunk)]) for i,k in enumerate(['beat','downbeat'])})
    beat,downbeat=aggregate_prediction(predictions,starts,len(features),1500,6,'keep_first','cpu')
    beats,downbeats=Postprocessor()(beat,downbeat)
    tb,td=aggregate_prediction(torch_predictions,starts,len(features),1500,6,'keep_first','cpu')
    tbeats,tdownbeats=Postprocessor()(tb,td)
    report['torchOnnxEventsIdentical']=bool(np.array_equal(beats,tbeats) and np.array_equal(downbeats,tdownbeats))
    report.update({'frames':len(features),'starts':starts.tolist(),'torchVsOnnxMaxAbs':logit_errors,
                   'beats':beats.tolist(),'downbeats':downbeats.tolist(),
                   'logits':{'beat':beat.tolist(),'downbeat':downbeat.tolist()}})
    # Separately quantify the context change caused by padding a short input to fixed 1500 frames.
    if len(features)<1488:
        dynamic=[{k:v[0] for k,v in model(c[None]).items()} for c in chunks]
        b,d=aggregate_prediction(dynamic,starts,len(features),1500,6,'keep_first','cpu')
        db,dd=Postprocessor()(b,d)
        report['dynamicShortReference']={'beats':db.tolist(),'downbeats':dd.tolist()}
if args.browser:
    browser=json.loads(args.browser.read_text())
    if abs(browser['duration']-report['duration'])>1/22050:raise ValueError('Browser audio duration mismatch.')
    if browser.get('pcmSha256') and browser['pcmSha256']!=report['pcmSha256']:raise ValueError('Browser PCM hash mismatch.')
    if browser['model']['sha256']!=model_hash:raise ValueError('Browser model mismatch.')
    report['browserComparison']={
        'maxAbs':{k:float(np.max(np.abs(np.array(browser['logits'][k])-report['logits'][k]))) for k in ['beat','downbeat']},
        'beatsIdentical':browser['beats']==report['beats'], 'downbeatsIdentical':browser['downbeats']==report['downbeats']}
args.report.write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['logits','beats','downbeats','dynamicShortReference']},indent=2))
if not report['torchOnnxEventsIdentical']:raise SystemExit('FAIL: PyTorch/ONNX events')
if any(v>.002 for e in logit_errors for v in e.values()):raise SystemExit('FAIL: PyTorch/ONNX logits')
if args.browser and (not report['browserComparison']['beatsIdentical'] or not report['browserComparison']['downbeatsIdentical'] or max(report['browserComparison']['maxAbs'].values())>.002):raise SystemExit('FAIL: browser parity')
