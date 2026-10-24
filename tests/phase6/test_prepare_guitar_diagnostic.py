import hashlib, importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('diagnostic',Path(__file__).resolve().parents[2]/'tools/prepare-guitar-diagnostic-corpus.py')
diagnostic=importlib.util.module_from_spec(spec);spec.loader.exec_module(diagnostic)
class MetadataTests(unittest.TestCase):
 def check(self,text,labels):
  raw=text.encode();return diagnostic.verify_metadata(raw,labels,hashlib.sha256(raw).hexdigest())
 def test_top_level_labels_exclude_raw_microphones(self):
  text="has_bleed: 'no'\nstems:\n  S01:\n    instrument: acoustic guitar\n    raw:\n      R01:\n        instrument: piano\n"
  self.assertEqual(self.check(text,['acoustic guitar']),['acoustic guitar'])
 def test_unknown_fingerprint_rejected(self):
  with self.assertRaises(ValueError):diagnostic.verify_metadata(b"has_bleed: 'no'",[], '0'*64)
 def test_other_instruments_invalidate_guitar_proxy(self):
  with self.assertRaises(ValueError):self.check("has_bleed: 'no'\n    instrument: acoustic guitar\n    instrument: piano\n",['acoustic guitar','piano'])
 def test_bleed_and_missing_guitars_rejected(self):
  for text,labels in [("has_bleed: 'yes'\n    instrument: acoustic guitar\n",['acoustic guitar']),("has_bleed: 'no'\n    instrument: electric bass\n",['electric bass'])]:
   with self.assertRaises(ValueError):self.check(text,labels)
if __name__=='__main__':unittest.main()
