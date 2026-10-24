import array, importlib.util, math, struct, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('corpus',Path(__file__).resolve().parents[2]/'tools/prepare-real-instrument-corpus.py')
corpus=importlib.util.module_from_spec(spec);spec.loader.exec_module(corpus)
class ReferenceTests(unittest.TestCase):
 def test_wav_preserves_stereo_float_peaks(self):
  samples=array.array('f',[2,-.5,0,1]);wav=corpus.wav_bytes(samples)
  self.assertEqual(wav[:4],b'RIFF');self.assertEqual(struct.unpack_from('<H',wav,20)[0],3);self.assertEqual(struct.unpack_from('<H',wav,22)[0],2);self.assertEqual(struct.unpack_from('<I',wav,24)[0],44100)
  self.assertEqual(list(corpus.floats(wav[44:])),list(samples))
 def test_common_gain_preserves_reference_sum(self):
  audio,gain=corpus.build_reference([1,-1,.5,-.5],[.5,-.5,.25,-.25])
  self.assertAlmostEqual(gain,.6);self.assertLessEqual(max(abs(x) for x in audio['mix']),.900001)
  for m,t,b in zip(audio['mix'],audio['reference'],audio['backing']):self.assertAlmostEqual(m,t+b,places=6)
 def test_invalid_sources_are_not_silently_padded(self):
  for a,b in [([1,2],[1]),([1,2,3],[1,2,3]),([math.nan,1],[0,0]),([0,0],[1,1])]:
   with self.assertRaises(ValueError):corpus.build_reference(a,b)
 def test_grouped_stems_are_aligned(self):
  self.assertEqual(list(corpus.combined([[1,2],[3,4]])),[4,6])
  with self.assertRaises(ValueError):corpus.combined([[1],[2,3]])
if __name__=='__main__':unittest.main()
