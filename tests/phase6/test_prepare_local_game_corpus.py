import importlib.util,pathlib,unittest,struct
import numpy as np
path=pathlib.Path(__file__).resolve().parents[2]/'tools/prepare-local-game-corpus.py'
spec=importlib.util.spec_from_file_location('local_game',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Preparation(unittest.TestCase):
 def test_common_gain_reconstructs_assigned_sum_without_clipping(self):
  tracks=[np.full((2,module.FRAMES),x,dtype=np.float32) for x in (.7,.3,.5)]
  a,g=module.construct(tracks)
  self.assertAlmostEqual(g,.6,places=6)
  np.testing.assert_array_equal(a['mix'],a['reference']+a['backing'])
  self.assertLessEqual(float(abs(a['mix']).max()),.900001)
  self.assertAlmostEqual(float(a['rhythm'][0,0]),.18,places=6)
 def test_invalid_finite_length_or_inactive_inputs_rejected(self):
  x=np.ones((2,module.FRAMES),dtype=np.float32)
  for bad in [np.zeros_like(x),np.full_like(x,np.nan),x[:,:-1]]:
   with self.assertRaises(ValueError):module.construct([bad,x,x])
 def test_wav_preserves_float_values_and_interleaving(self):
  x=np.array([[1.1,-.5],[.2,.8]],dtype=np.float32);b=module.wav(x)
  self.assertEqual(struct.unpack_from('<H',b,20)[0],3)
  np.testing.assert_array_equal(np.frombuffer(b[44:],dtype='<f4').reshape(-1,2).T,x)
if __name__=='__main__':unittest.main()
