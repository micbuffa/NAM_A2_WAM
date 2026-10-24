#!/usr/bin/env python3
"""Prepare local research-only references. Python stdlib + ffmpeg, no network."""
import argparse, array, csv, hashlib, io, json, struct, subprocess, sys, tarfile, zipfile
from pathlib import Path
FRAMES = 264600
RATE = 44100
PROTOCOL = 'real-instrument-corpus-v1'
TRACKS = [
 ('musdb-falcon', 'The Easton Ellises - Falcon 69'),
 ('musdb-reggae', 'Arise - Run Run Run'),
 ('musdb-metal', 'We Fell From The Sky - Not You'),
]
# Official MedleyDB mixing_coefficients.yaml; checked against the supplied file.
COEFFICIENTS = {1: .6354871509502455, 2: .12610504621272442, 3: .0624147327727016, 4: .8433924607944484, 5: .29222231756693756}
URLS = {
 'musdb':'https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip',
 'medley':'https://zenodo.org/record/1438309/files/MedleyDB_Sample.tar.gz?download=1',
 'coefficients':'https://raw.githubusercontent.com/marl/medleydb/master/medleydb/resources/mixing_coefficients.yaml',
 'licenses':'https://raw.githubusercontent.com/sigsep/website/master/content/datasets/assets/tracklist.csv',
}
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def floats(raw):
 a = array.array('f'); a.frombytes(raw)
 if sys.byteorder != 'little': a.byteswap()
 return a

def wav_bytes(samples):
 if len(samples) % 2: raise ValueError('Stereo samples required')
 a = array.array('f', samples)
 if sys.byteorder != 'little': a.byteswap()
 data = a.tobytes()
 return b'RIFF'+struct.pack('<I',36+len(data))+b'WAVEfmt '+struct.pack('<IHHIIHH',16,3,2,RATE,RATE*8,8,32)+b'data'+struct.pack('<I',len(data))+data

def combined(parts):
 if not parts or len({len(x) for x in parts}) != 1: raise ValueError('Unaligned sources')
 return array.array('f', (sum(values) for values in zip(*parts)))

def build_reference(target, backing):
 import math
 if len(target) != len(backing) or not target or len(target) % 2: raise ValueError('Unaligned reference')
 if not all(math.isfinite(x) for part in [target,backing] for x in part): raise ValueError('Nonfinite samples')
 peak=max(abs(a+b) for a,b in zip(target,backing)); gain=min(1,.9/peak) if peak else 1
 t=array.array('f',(x*gain for x in target)); b=array.array('f',(x*gain for x in backing)); m=combined([t,b])
 if any(sum(x*x for x in part)/len(part)<1e-10 for part in [t,b,m]): raise ValueError('Inactive target, backing or mixture')
 return {'mix':m,'reference':t,'backing':b},gain

def decode(path, offset=0, stream=0):
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map',f'0:a:{stream}','-ss',str(offset),'-t','6','-ar',str(RATE),'-ac','2','-f','f32le','pipe:1'])
 result=floats(raw)
 if len(result)!=FRAMES*2: raise ValueError(f'Unexpected duration: {path}')
 return result

def write_case(root, info, target, backing):
 audio,gain=build_reference(target,backing); directory=root/info['id'];directory.mkdir(parents=True,exist_ok=True)
 info.update(frames=FRAMES,sampleRate=RATE,commonGain=gain,files={})
 for role, samples in audio.items():
  name=role+'.wav';path=directory/name;path.write_bytes(wav_bytes(samples));info['files'][role]={'path':info['id']+'/'+name,'sha256':sha(path)}
 print(info['id'], 'gain',round(gain,6),flush=True)
 return info

def prepare(args):
 root=Path(args.output);root.mkdir(parents=True,exist_ok=True);sources=root/'sources';sources.mkdir(exist_ok=True)
 inputs={'musdb':args.musdb,'medley':args.medley,'coefficients':args.coefficients,'licenses':args.licenses}
 manifest={'protocol':PROTOCOL,'sampleRate':RATE,'frames':FRAMES,'redistributeAudio':False,'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],'sources':{k:{'url':URLS[k],'sha256':sha(v)} for k,v in inputs.items()},'cases':[]}
 licenses={r['Track Name']:r for r in csv.DictReader(Path(args.licenses).read_text().splitlines())}
 with zipfile.ZipFile(args.musdb) as z:
  for id,title in TRACKS:
   name='test/'+title+'.stem.mp4';path=sources/(id+'.mp4');path.write_bytes(z.read(name))
   stems=[decode(path,stream=i) for i in [1,2,3,4]]
   info={'id':id,'dataset':'MUSDB18-7s','track':title,'group':title,'split':'test','offsetSeconds':0,'target':'bass','otherIsGuitar':False,'license':licenses[title]['License'],'genre':licenses[title]['Genre'],'sourceMember':name,'sourceSha256':sha(path)}
   manifest['cases'].append(write_case(root,info,stems[1],combined([stems[0],stems[2],stems[3]])))
  manifest['medleyPresentInMusdbPreview']=any('Liz Nelson - Rainfall' in n for n in z.namelist())
 coeff_text=Path(args.coefficients).read_text();line=coeff_text.split('LizNelson_Rainfall: ',1)[1].split('}',1)[0]
 for value in COEFFICIENTS.values():
  if str(value) not in line: raise ValueError('Official mixing coefficients changed')
 with tarfile.open(args.medley) as t:
  members={Path(m.name).name:m for m in t.getmembers() if m.isfile() and '/LizNelson_Rainfall/' in m.name and '/._' not in m.name}
  metadata=t.extractfile(members['LizNelson_Rainfall_METADATA.yaml']).read();(sources/'LizNelson_Rainfall_METADATA.yaml').write_bytes(metadata)
  if b"has_bleed: 'no'" not in metadata: raise ValueError('Bleed metadata changed')
  if metadata.count(b'instrument: female singer')!=6 or metadata.count(b'instrument: acoustic guitar')!=2 or metadata.count(b'instrument: clean electric guitar')!=2: raise ValueError('Instrument labels changed')
  paths=[]
  for i in range(1,6):
   name=f'LizNelson_Rainfall_STEM_{i:02d}.wav';path=sources/name;path.write_bytes(t.extractfile(members[name]).read());paths.append(path)
  for offset in [20,65,120]:
   parts=[array.array('f',(x*COEFFICIENTS[i] for x in decode(path,offset))) for i,path in enumerate(paths,1)]
   info={'id':f'medley-rainfall-{offset}','dataset':'MedleyDB sample','track':'Liz Nelson & Jennifer Davies — Rainfall','group':'LizNelson_Rainfall','split':'sample','offsetSeconds':offset,'target':'guitar','otherIsGuitar':True,'hasBleed':False,'license':'CC BY-NC-SA 4.0','guitarStemIndices':[4,5],'mixingCoefficients':COEFFICIENTS,'sourceStems':{p.name:sha(p) for p in paths},'metadataSha256':hashlib.sha256(metadata).hexdigest()}
   manifest['cases'].append(write_case(root,info,combined(parts[3:]),combined(parts[:3])))
 (root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 return manifest

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 for name in ['musdb','medley','coefficients','licenses','output']:p.add_argument('--'+name,required=True)
 prepare(p.parse_args())
