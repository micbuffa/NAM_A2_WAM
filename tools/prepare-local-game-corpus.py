#!/usr/bin/env python3
"""Reconstruct only the six frozen GHA excerpts; originals remain untouched."""
import argparse, hashlib, json, pathlib, struct, subprocess
import numpy as np
RATE, FRAMES = 44100, 264600
REPO = pathlib.Path(__file__).resolve().parents[1]
PREFLIGHT = REPO/'examples/wam/source-separation/benchmarks/local-stems-preflight-2026-10-25.json'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def wav(x):
    data = np.asarray(x.T, dtype='<f4').tobytes()
    return b'RIFF'+struct.pack('<I',36+len(data))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,3,2,RATE,RATE*8,8,32)+b'data'+struct.pack('<I',len(data))+data

def construct(tracks):
    if len(tracks)!=3 or any(x.shape!=(2,FRAMES) or not np.isfinite(x).all() for x in tracks):
        raise ValueError('Three finite stereo six-second stems required')
    # Defined synthetic sum of supplied game stems, not a claim about the commercial mix.
    backing = tracks[1]+tracks[2]
    raw = tracks[0]+backing
    gain = min(1.,.9/max(float(np.abs(raw).max()),1e-20))
    reference = (tracks[0]*gain).astype(np.float32)
    backing = (backing*gain).astype(np.float32)
    rhythm = (tracks[1]*gain).astype(np.float32)
    mix = reference+backing
    if any(float(np.mean(x.astype(np.float64)**2))<1e-12 for x in (reference,backing,rhythm,mix)):
        raise ValueError('Inactive supplied stem')
    return {'mix':mix,'reference':reference,'backing':backing,'rhythm':rhythm},gain

def prepare(root, output):
    pre = json.loads(PREFLIGHT.read_text())
    manifest={'protocol':'local-game-assigned-stems-v1','sampleRate':RATE,'frames':FRAMES,
              'redistributeAudio':False,'recommendationEligible':False,'trainingExposure':'unknown',
              'referenceScope':'assigned guitar.ogg game stem; purity and exhaustivity unverified',
              'rhythmScope':'rhythm.ogg supplied stem; bass semantics unconfirmed',
              'recipe':'mix = guitar.ogg + (rhythm.ogg + song.ogg), one common gain; constructed mixture, not commercial recording',
              'decodePolicy':'origin to 96s, exact frame slices; no seek, alignment search or padding',
              'preflightSha256':sha(PREFLIGHT.read_bytes()),'cases':[]}
    for n,entry in enumerate(pre['selectedFirstBatch']):
        decoded={}
        for f in entry['files']:
            path=root/entry['collection']/entry['folder']/f['name']
            if sha(path.read_bytes())!=f['sha256']: raise ValueError('Source hash changed: '+f['name'])
            raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-t','96','-map','0:a:0','-f','f32le','-ac','2','-ar',str(RATE),'pipe:1'])
            x=np.frombuffer(raw,dtype='<f4').reshape(-1,2).T
            if x.shape[1]<96*RATE: raise ValueError('Short decode')
            decoded[f['name']]=x
        for start in (20,90):
            caseid=f'gha-{n+1}-{start}'
            slices=[decoded[k][:,start*RATE:start*RATE+FRAMES] for k in ('guitar.ogg','rhythm.ogg','song.ogg')]
            audio,gain=construct(slices)
            c={'id':caseid,'track':entry['folder'],'offsetSeconds':start,'durationSeconds':6,'frames':FRAMES,'sampleRate':RATE,'target':'guitar','otherIsGuitar':False,'commonGain':gain,'sourceFiles':entry['files'],'files':{}}
            for role,x in audio.items():
                data=wav(x); rel=f'{caseid}/{role}.wav';path=output/rel;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
                c['files'][role]={'path':rel,'sha256':sha(data),'bytes':len(data)}
            manifest['cases'].append(c)
            print(caseid,gain,flush=True)
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('root',type=pathlib.Path);p.add_argument('--output',type=pathlib.Path,default=REPO/'test-data/source-separation/local-game-stems')
    args=p.parse_args();prepare(args.root,args.output)
