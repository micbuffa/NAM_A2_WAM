#!/usr/bin/env python3
"""Recorded guitar diagnostics from MUSDB train. Not an independent test set.

Uses the official seven-second preview already downloaded; no network access.
Python standard library and ffmpeg. Audio remains local and untracked.
"""
import argparse, csv, hashlib, importlib.util, json, re, zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('references', Path(__file__).with_name('prepare-real-instrument-corpus.py'))
refs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refs)
CASES = [
 ('guitar-country', 'Music Delta - Country1', 'MusicDelta_Country1', 'acoustic', '7c049a9d4fde92a57f888ae99b8da92e420764b3e670f6f82eb30d469a672b5c', ['drum set','electric bass','acoustic guitar','acoustic guitar','male singer']),
 ('guitar-grunge', 'Music Delta - Grunge', 'MusicDelta_Grunge', 'distorted', 'fc0bc0524be54e030ae181d5c0faba5583596a0e9946314bad38ef83208f1a50', ['drum set','electric bass','distorted electric guitar','distorted electric guitar','male singer']),
 ('guitar-meaxic', 'Meaxic - Take A Step', 'Meaxic_TakeAStep', 'clean and distorted', 'c20cc8af7b06a1378612c0682d6789157b260ada2e0298fa5f25ec5afbb64dd2', ['electric bass','clean electric guitar','distorted electric guitar','male singer','drum set','vocalists','vocalists','vocalists']),
]

def verify_metadata(raw, expected, checksum):
 if hashlib.sha256(raw).hexdigest() != checksum:
  raise ValueError('Official metadata fingerprint changed')
 text = raw.decode('utf8')
 # Exactly four spaces: top-level stems only, not the nested raw microphone labels.
 labels = re.findall(r'^    instrument: (.+)$', text, re.M)
 if "has_bleed: 'no'" not in text or labels != expected:
  raise ValueError('Stem inventory or bleed declaration changed')
 allowed = {'drum set','electric bass','male singer','female singer','vocalists',
            'acoustic guitar','clean electric guitar','distorted electric guitar'}
 if not any('guitar' in s for s in labels) or any(s not in allowed for s in labels):
  raise ValueError('Other cannot be treated as isolated guitar')
 return labels

def prepare(args):
 root = Path(args.output); root.mkdir(parents=True,exist_ok=True)
 sources = root/'sources'; sources.mkdir(exist_ok=True)
 if refs.sha(args.musdb) != '365f66acffc57282e474a4c24b32afec3678258c50b8d45646ac849b0a287df3':
  raise ValueError('MUSDB preview archive fingerprint changed')
 licenses = {r['Track Name']:r for r in csv.DictReader(Path(args.licenses).read_text().splitlines())}
 manifest = {'protocol':'guitar-diagnostic-corpus-v1','purpose':'training-split-diagnostic',
  'sampleRate':refs.RATE,'frames':refs.FRAMES,'redistributeAudio':False,
  'trainingOverlap':'MUSDB train: known training-set membership, not independent validation',
  'sources':{'musdb':{'url':refs.URLS['musdb'],'sha256':refs.sha(args.musdb)},
             'licenses':{'url':refs.URLS['licenses'],'sha256':refs.sha(args.licenses)}},'cases':[]}
 with zipfile.ZipFile(args.musdb) as archive:
  for id,title,metadata_id,style,checksum,expected in CASES:
   metadata = Path(args.metadata)/(metadata_id+'_METADATA.yaml')
   labels = verify_metadata(metadata.read_bytes(),expected,checksum)
   (sources/metadata.name).write_bytes(metadata.read_bytes())
   member = 'train/'+title+'.stem.mp4'; path = sources/(id+'.mp4'); path.write_bytes(archive.read(member))
   stems = [refs.decode(path,stream=i) for i in [1,2,3,4]]
   info = {'id':id,'dataset':'MUSDB18-7s / MedleyDB metadata','track':title,'group':metadata_id,
    'split':'train','offsetSeconds':0,'target':'guitar','otherIsGuitar':True,'hasBleed':False,
    'style':style,'license':licenses[title]['License'],'genre':licenses[title]['Genre'],
    'sourceMember':member,'sourceSha256':refs.sha(path),'metadataSha256':checksum,
    'metadataURL':'https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/'+metadata.name,
    'stemInstruments':labels,'referenceStream':3,'trainingSetDiagnostic':True}
   manifest['cases'].append(refs.write_case(root,info,stems[2],refs.combined([stems[0],stems[1],stems[3]])))
 (root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 return manifest

if __name__ == '__main__':
 parser = argparse.ArgumentParser(description=__doc__)
 for name in ['musdb','metadata','licenses','output']: parser.add_argument('--'+name,required=True)
 prepare(parser.parse_args())
