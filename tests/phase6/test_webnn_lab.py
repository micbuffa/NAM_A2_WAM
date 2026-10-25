import pathlib,importlib.util,tempfile,tarfile,io,json,hashlib,base64,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'tools'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
prepare=module('prepare_webnn','prepare-webnn-lab.py')
class Runtime(unittest.TestCase):
 def fixture(self,p):
  with tarfile.open(p,'w:gz') as t:
   for name,data in [(f'package/dist/{n}',n.encode()) for n in prepare.FILES]+[('package/package.json',json.dumps({'version':prepare.VERSION,'license':'MIT'}).encode()),('../../escape',b'bad')]:
    info=tarfile.TarInfo(name);info.size=len(data);t.addfile(info,io.BytesIO(data))
  return 'sha512-'+base64.b64encode(hashlib.sha512(p.read_bytes()).digest()).decode()
 def test_sri_mismatch_writes_nothing(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);p=root/'a.tgz';self.fixture(p)
   with self.assertRaises(ValueError):prepare.unpack(p,root/'out')
   self.assertFalse((root/'out').exists())
 def test_allowlist_extracts_only_static_files_without_traversal(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);p=root/'a.tgz';sri=self.fixture(p);r=prepare.unpack(p,root/'out',sri)
   self.assertEqual(set(r),set(prepare.FILES));self.assertFalse((root/'escape').exists());self.assertEqual(len(list((root/'out').iterdir())),4)
if __name__=='__main__':unittest.main()
