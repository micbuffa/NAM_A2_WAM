#!/usr/bin/env python3
"""Install only pinned static runtime assets in an ignored WebNN laboratory."""
import argparse,base64,hashlib,json,pathlib,tarfile,urllib.request
VERSION='1.30.0'
URL=f'https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-{VERSION}.tgz'
INTEGRITY='sha512-q0y+JrrtukXSzsBWEMccVfqX25LRmosXHF+CaRJmg8pZClzcV7svNc4rKY3jL02Vb7QmRMDs1SigqR4CXAfKYQ=='
FILES=['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm']
REPO=pathlib.Path(__file__).resolve().parents[1]
def unpack(archive,output,integrity=INTEGRITY):
 data=archive.read_bytes()
 if 'sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode()!=integrity:raise ValueError('Runtime archive integrity mismatch')
 assets={}
 with tarfile.open(archive) as t:
  for name in FILES:
   member=t.getmember('package/dist/'+name)
   if not member.isfile():raise ValueError('Unexpected runtime member')
   assets[name]=t.extractfile(member).read()
  package=json.loads(t.extractfile('package/package.json').read())
  if package.get('version')!=VERSION or package.get('license')!='MIT':raise ValueError('Unexpected package identity')
 output.mkdir(parents=True,exist_ok=True)
 for name,data in assets.items():(output/name).write_bytes(data)
 (output/'package.json').write_text(json.dumps(package,indent=2)+'\n')
 return {name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in assets.items()}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--archive',type=pathlib.Path);a=p.parse_args();lab=REPO/'third_party/nam-webnn-probe';lab.mkdir(parents=True,exist_ok=True);archive=a.archive or lab/'onnxruntime-web-1.30.0.tgz'
 if not a.archive:urllib.request.urlretrieve(URL,archive)
 files=unpack(archive,lab/'runtime')
 licenseURL=f'https://raw.githubusercontent.com/microsoft/onnxruntime/v{VERSION}/LICENSE';licenseData=urllib.request.urlopen(licenseURL).read();(lab/'runtime/LICENSE').write_bytes(licenseData)
 tableURL=f'https://raw.githubusercontent.com/microsoft/onnxruntime/v{VERSION}/js/web/docs/webnn-operators.md';table=urllib.request.urlopen(tableURL).read();(lab/'webnn-operators.md').write_bytes(table)
 manifest={'protocol':'webnn-runtime-lab-v1','version':VERSION,'packageURL':URL,'packageIntegrity':INTEGRITY,'packageSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'license':{'name':'MIT','url':licenseURL,'sha256':hashlib.sha256(licenseData).hexdigest()},'operatorTable':{'url':tableURL,'sha256':hashlib.sha256(table).hexdigest()},'files':files,'location':'third_party/nam-webnn-probe/runtime','productionRuntimeUnchanged':'1.22.0','scope':'isolated source-only research lab; no production model catalogue change'}
 out=REPO/'examples/wam/source-separation/research/webnn-runtime.json';out.write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))
