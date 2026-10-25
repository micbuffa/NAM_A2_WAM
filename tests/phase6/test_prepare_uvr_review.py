import importlib.util,pathlib,tempfile,json,hashlib,unittest
p=pathlib.Path(__file__).resolve().parents[2]/'tools/prepare-uvr-review-inputs.py';s=importlib.util.spec_from_file_location('uvr_inputs',p);module=importlib.util.module_from_spec(s);s.loader.exec_module(module)
class Inputs(unittest.TestCase):
 def fixture(self,root):
  cases=[]
  for i in (1,2,3):
   for t in (20,90):
    cid=f'gha-{i}-{t}';data=f'fixture-{cid}'.encode();p=root/cid/'mix.wav';p.parent.mkdir(parents=True);p.write_bytes(data);cases.append({'id':cid,'track':'fixture','offsetSeconds':t,'files':{'mix':{'path':f'{cid}/mix.wav','sha256':hashlib.sha256(data).hexdigest()}}})
  m={'protocol':'local-game-assigned-stems-v1','recommendationEligible':False,'cases':cases};(root/'manifest.json').write_text(json.dumps(m));return m
 def test_unique_names_byte_identical_and_no_inference_claim(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);m=self.fixture(root);out=root/'out';r=module.prepare(root,out);self.assertEqual(len(set(x['input'] for x in r['cases'])),6)
   for a,b in zip(m['cases'],r['cases']):self.assertEqual((root/a['files']['mix']['path']).read_bytes(),(out/b['input']).read_bytes())
   self.assertEqual(r['status'],'inputs-prepared-no-uvr-inference')
 def test_all_hashes_checked_before_writing(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);self.fixture(root);(root/'gha-3-90/mix.wav').write_bytes(b'bad');out=root/'out'
   with self.assertRaises(ValueError):module.prepare(root,out)
   self.assertFalse(out.exists())
 def test_modified_scope_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);m=self.fixture(root);m['cases'].pop();(root/'manifest.json').write_text(json.dumps(m))
   with self.assertRaises(ValueError):module.prepare(root,root/'out')
if __name__=='__main__':unittest.main()
