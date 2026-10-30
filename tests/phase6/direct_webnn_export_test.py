import importlib.util,pathlib,unittest
import onnx,numpy as np
from onnx import helper,numpy_helper
spec=importlib.util.spec_from_file_location('direct_export',pathlib.Path(__file__).resolve().parents[2]/'tools/export-direct-webnn.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def lower(nodes,inputs,outputs,constants,**options):
 model=helper.make_model(helper.make_graph(nodes,'test',inputs,outputs,[numpy_helper.from_array(v,k)for k,v in constants.items()]),opset_imports=[helper.make_opsetid('',17)],ir_version=9)
 return module.Lowerer(onnx.shape_inference.infer_shapes(model,data_prop=True),**options).export()
def tensor(name,shape):return helper.make_tensor_value_info(name,onnx.TensorProto.FLOAT,shape)
class ExportTests(unittest.TestCase):
 def test_scalar_gather_stays_scalar(self):
  graph,weights=lower([helper.make_node('Gather',['x','index'],['y'],axis=-1)],[tensor('x',[2,3])],[tensor('y',[2])],{'index':np.array(1,dtype='int64')})
  op=graph['operations'][0];constant=graph['constants'][op['args'][1]];self.assertEqual(constant['shape'],[]);self.assertEqual(constant['dataType'],'int32');self.assertEqual(constant['bytes'],4)
 def test_static_scalar_gather_slice_equivalence_for_axes_and_negative_indices(self):
  source=np.arange(24,dtype='float32').reshape(2,3,4)
  for axis,index in [(0,1),(1,-1),(-1,2)]:
   output=list(source.shape);del output[axis]
   graph,_=lower([helper.make_node('Gather',['x','index'],['y'],axis=axis)],[tensor('x',list(source.shape))],[tensor('y',output)],{'index':np.array(index,dtype='int64')},static_scalar_gather_slices=True)
   selection,reshape=graph['operations'];self.assertEqual(selection['op'],'slice');self.assertEqual(reshape['op'],'reshape');self.assertEqual(reshape['checkShape'],output)
   starts,sizes=selection['args'][1:];actual=source[tuple(slice(start,start+size)for start,size in zip(starts,sizes))].reshape(output)
   np.testing.assert_array_equal(actual,np.take(source,index,axis=axis));self.assertEqual(graph['constants'],{})
 def test_static_scalar_gather_rejects_out_of_range_index(self):
  with self.assertRaisesRegex(ValueError,'out of bounds'):
   lower([helper.make_node('Gather',['x','index'],['y'],axis=0)],[tensor('x',[2,3])],[tensor('y',[3])],{'index':np.array(2,dtype='int64')},static_scalar_gather_slices=True)
 def test_strided_slice_uses_span_size_and_positive_axis(self):
  graph,_=lower([helper.make_node('Slice',['x','starts','ends','axes','steps'],['y'])],[tensor('x',[1,8])],[tensor('y',[1,3])],{'starts':np.array([1],dtype='int64'),'ends':np.array([7],dtype='int64'),'axes':np.array([-1],dtype='int64'),'steps':np.array([2],dtype='int64')})
  op=graph['operations'][0];self.assertEqual(op['args'][1:],[ [0,1],[1,6] ]);self.assertEqual(op['checkShape'],[1,3]);self.assertEqual(op['options']['strides'],[1,2])
 def test_empty_tail_is_removed_from_concat(self):
  graph,_=lower([helper.make_node('Slice',['x','starts','ends','axes'],['empty']),helper.make_node('Concat',['x','empty'],['y'],axis=1)],[tensor('x',[1,3])],[tensor('y',[1,3])],{'starts':np.array([3],dtype='int64'),'ends':np.array([np.iinfo(np.int64).max],dtype='int64'),'axes':np.array([1],dtype='int64')})
  self.assertEqual(graph['operations'],[]);self.assertEqual(graph['outputs']['y']['id'],graph['inputs']['x']['id'])
 def test_conv1d_is_lifted_with_exact_spatial_options(self):
  graph,_=lower([helper.make_node('Conv',['x','w'],['y'],kernel_shape=[3],strides=[2],pads=[1,1])],[tensor('x',[1,2,9])],[tensor('y',[1,4,5])],{'w':np.zeros([4,2,3],dtype='float32')})
  conv=next(op for op in graph['operations']if op['op']=='conv2d');self.assertIn(conv['args'][1],graph['constants']);self.assertEqual(graph['constants'][conv['args'][1]]['shape'],[4,2,1,3]);self.assertFalse(any(op['op']=='reshape'and op['args'][0]in graph['constants']for op in graph['operations']));self.assertEqual(conv['options']['padding'],[0,0,1,1]);self.assertEqual(conv['options']['strides'],[1,2]);self.assertEqual(graph['operations'][-1]['args'][1],[1,4,5])
 def test_constant_views_are_reused_without_emitting_native_operations(self):
  m=helper.make_model(helper.make_graph([], 'constant', [tensor('x',[1])], [tensor('x',[1])], [numpy_helper.from_array(np.arange(6,dtype='float32').reshape(2,3),'w')]),opset_imports=[helper.make_opsetid('',17)],ir_version=9)
  lowerer=module.Lowerer(m);key=lowerer.value('w');a=lowerer.reshape(key,[1,2,3]);b=lowerer.reshape(key,[1,2,3]);self.assertEqual(a,b);self.assertEqual(lowerer.ops,[]);np.testing.assert_array_equal(lowerer.constants[a].ravel(),np.arange(6,dtype='float32'))
if __name__=='__main__':unittest.main()
