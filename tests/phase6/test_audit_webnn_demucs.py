import importlib.util,pathlib,unittest
import onnx
from onnx import helper,TensorProto
p=pathlib.Path(__file__).resolve().parents[2]/'tools/audit-webnn-demucs.py';s=importlib.util.spec_from_file_location('audit_webnn',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Audit(unittest.TestCase):
 def test_counts_symbolic_shapes_domain_and_constant_weights(self):
  x=helper.make_tensor_value_info('x',TensorProto.FLOAT,[1,2,'N']);y=helper.make_tensor_value_info('y',TensorProto.FLOAT,[1,2,'N']);w=helper.make_tensor('w',TensorProto.FLOAT,[2,2,1],[1,0,0,1]);nodes=[helper.make_node('Conv',['x','w'],['a']),helper.make_node('Mystery',['a'],['b'],domain='custom'),helper.make_node('Conv',['b','w'],['y'],domain='custom')]
  graph=helper.make_graph(nodes,'test',[x],[y],[w]);model=helper.make_model(graph)
  r=m.audit(model,'| Conv | 11+ | conv2d | constant W |')
  self.assertEqual(r['nodes'],3);self.assertEqual(r['inputs'][0]['shape'][-1],'N');a=next(o for o in r['operatorGroups'] if o['domain']=='ai.onnx');self.assertTrue(a['inPinnedWebnnTable']);self.assertEqual(a['secondInputDirectConstantNodes'],1);self.assertTrue(all(not o['inPinnedWebnnTable'] for o in r['operatorGroups'] if o['domain']=='custom'))
 def test_unlisted_constant_not_claimed_runtime_failure(self):
  y=helper.make_tensor_value_info('y',TensorProto.FLOAT,[1]);n=helper.make_node('Constant',[],['y'],value=helper.make_tensor('c',TensorProto.FLOAT,[1],[1]));r=m.audit(helper.make_model(helper.make_graph([n],'g',[],[y])),'')
  self.assertEqual(r['operatorsNotListed'],['Constant']);self.assertIn('may fold',r['interpretation'])
if __name__=='__main__':unittest.main()
