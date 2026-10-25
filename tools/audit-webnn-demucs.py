#!/usr/bin/env python3
"""Static audit of the exact production Demucs4 graph; no graph rewriting."""
import collections,hashlib,json,pathlib,re
import onnx
from onnx import TensorProto,helper,numpy_helper
ROOT=pathlib.Path(__file__).resolve().parents[1]
def audit(model,table):
 entries={line.split('|')[1].strip():line.split('|')[4].strip() for line in table.splitlines() if line.startswith('| ') and len(line.split('|'))>=6}
 constant={i.name for i in model.graph.initializer}|{o for n in model.graph.node if n.op_type=='Constant' for o in n.output}
 def tensor(t):return {'name':t.name,'dtype':TensorProto.DataType.Name(t.type.tensor_type.elem_type),'shape':[d.dim_value if d.HasField('dim_value') else d.dim_param or '?' for d in t.type.tensor_type.shape.dim]}
 groups=collections.defaultdict(list)
 for n in model.graph.node:groups[(n.domain or 'ai.onnx',n.op_type)].append(n)
 rows=[]
 for (domain,op),nodes in sorted(groups.items()):
  row={'domain':domain,'op':op,'nodes':len(nodes),'inPinnedWebnnTable':domain=='ai.onnx' and op in entries,'documentedConstraints':entries.get(op) if domain=='ai.onnx' else None,'note':'Listing alone does not prove backend support; shapes/attributes and optimized partitions must be tested.'}
  if op in ['Conv','ConvTranspose','Gemm','MatMul']:row['secondInputDirectConstantNodes']=sum(len(n.input)>1 and n.input[1] in constant for n in nodes)
  if op in ['LayerNormalization','InstanceNormalization','Softmax','Split','Pad','ScatterND','ConvTranspose','Conv']:row['attributes']=[{'name':n.name,'values':{a.name:str(helper.get_attribute_value(a)) for a in n.attribute}} for n in nodes]
  rows.append(row)
 return {'opsets':[{'domain':o.domain or 'ai.onnx','version':o.version} for o in model.opset_import],'nodes':len(model.graph.node),'inputs':[tensor(t) for t in model.graph.input],'outputs':[tensor(t) for t in model.graph.output],'initializers':dict(collections.Counter(TensorProto.DataType.Name(t.data_type) for t in model.graph.initializer)),'operatorGroups':rows,'operatorsNotListed':[r['op'] for r in rows if not r['inPinnedWebnnTable']],'interpretation':'Static pre-optimization inventory, not a guarantee of graph compilation or WebNN coverage. Shape/control constants may fold; unlisted ops may fall back. No performance inferred.'}
if __name__=='__main__':
 path=ROOT/'third_party/nam-webgpu-probe/htdemucs-core.onnx';data=path.read_bytes();digest=hashlib.sha256(data).hexdigest();expected='da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748'
 if digest!=expected:raise ValueError('Model differs from production checkpoint')
 table=(ROOT/'third_party/nam-webnn-probe/webnn-operators.md').read_text();result=audit(onnx.load(path),table);result.update(protocol='webnn-demucs4-static-v1',date='2026-10-25',modelSha256=digest,modelBytes=len(data),runtimeVersion='1.30.0',operatorTableSha256=hashlib.sha256(table.encode()).hexdigest())
 p=ROOT/'examples/wam/source-separation/research/webnn-demucs4-audit.json';p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='operatorGroups'},indent=2))
