#!/usr/bin/env python3
"""Copy the six already-prepared local mixtures byte-for-byte with unique UVR names."""
import argparse,hashlib,json,pathlib
REPO=pathlib.Path(__file__).resolve().parents[1]
def prepare(source,output):
 m=json.loads((source/'manifest.json').read_text());expected={f'gha-{i}-{t}' for i in (1,2,3) for t in (20,90)}
 if m.get('protocol')!='local-game-assigned-stems-v1' or m.get('recommendationEligible') is not False or len(m.get('cases',[]))!=6 or {c['id'] for c in m['cases']}!=expected:raise ValueError('Frozen six-case corpus required')
 pending=[]
 for c in m['cases']:
  file=c['files']['mix'];rel=f"{c['id']}/mix.wav"
  if file['path']!=rel:raise ValueError('Unexpected source path')
  data=(source/rel).read_bytes()
  if hashlib.sha256(data).hexdigest()!=file['sha256']:raise ValueError('Mix SHA mismatch')
  pending.append((c,data))
 # Verify all sources before creating any outputs.
 rows=[]
 for c,data in pending:
  rel=f"inputs/{c['id']}.wav";p=output/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
  rows.append({'caseId':c['id'],'track':c['track'],'offsetSeconds':c['offsetSeconds'],'input':rel,'sha256':hashlib.sha256(data).hexdigest(),'referenceFiles':c['files']})
 result={'protocol':'uvr-game-review-inputs-v1','sourceProtocol':m['protocol'],'redistributeAudio':False,'recommendationEligible':False,'trainingExposure':'unknown','status':'inputs-prepared-no-uvr-inference','recipe':'Byte-identical copies of G1 constructed mixtures; no new normalization or encoding','cases':rows}
 (output/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,default=REPO/'test-data/source-separation/local-game-stems');p.add_argument('--output',type=pathlib.Path,default=REPO/'test-data/source-separation/uvr-review');a=p.parse_args();print(json.dumps(prepare(a.source,a.output),ensure_ascii=False,indent=2))
