"""Download the exact research files referenced by the SCNet feasibility record.
Only stdlib is needed here. The files are ignored by Git and not distributed.
Run validate-scnet-candidate.py with the scientific Python environment afterwards.
"""
import hashlib,json,pathlib,urllib.request,os
root=pathlib.Path(__file__).resolve().parent.parent
manifest=json.loads((root/'examples/wam/source-separation/research/scnet-candidate.json').read_text())
destination=root/'third_party/scnet-probe'
for item in manifest['preparationFiles']:
 path=destination/item['path'];path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists():
  if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError(f'Existing file SHA mismatch: {path}')
  continue
 part=path.with_suffix(path.suffix+'.part')
 try:
  print('Download',item['url'],flush=True);urllib.request.urlretrieve(item['url'],part)
  if hashlib.sha256(part.read_bytes()).hexdigest()!=item['sha256']:raise ValueError(f'SHA mismatch: {path}')
  os.replace(part,path)
 finally:
  if part.exists():part.unlink()
(destination/'scnet_code/scnet/__init__.py').touch()
print('SCNet preparation verified. No production model enabled.')
