#!/usr/bin/env python3
"""Generate a small, hash-bound WebGPU ReduceL2 workaround; never distribute new weights.
Usage: python tools/prepare-beat-this-webgpu.py --model /path/to/beat_this.onnx
Requires onnx. Source graph SHA is pinned; output JSON stores only replacement nodes,
not learned parameters. The original CPU/WASM graph remains unchanged.
"""
import argparse,base64,hashlib,json
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--model',type=Path,required=True)
parser.add_argument('--output',type=Path,default=Path('examples/wam/projects/tempo/beat-this-webgpu-patch.json'))
parser.add_argument('--patched-model',type=Path)
args=parser.parse_args()
import onnx
from onnx import helper,TensorProto
SOURCE_SHA='1337dc6c21257ed6b803418efc320df42b5d8eb296ef16648ef60457cd4b9e55'
source=args.model.read_bytes()
if hashlib.sha256(source).hexdigest()!=SOURCE_SHA:raise ValueError('Unexpected source model SHA256')
def varint(value):
    out=bytearray()
    while value>=128:out.append((value&127)|128);value>>=7
    out.append(value);return bytes(out)
def read_varint(data,pos):
    value=0;shift=0
    while pos<len(data) and shift<64:
        byte=data[pos];pos+=1;value|=(byte&127)<<shift
        if byte<128:return value,pos
        shift+=7
    raise ValueError('Invalid protobuf varint')
def fields(data,start,end):
    pos=start
    while pos<end:
        field_start=pos;tag,pos=read_varint(data,pos);wire=tag&7;header_end=pos
        if wire==2:size,pos=read_varint(data,pos);payload=pos;pos+=size
        elif wire==0:payload=pos;_,pos=read_varint(data,pos)
        elif wire in [1,5]:payload=pos;pos+=8 if wire==1 else 4
        else:raise ValueError('Unsupported protobuf wire type')
        if pos>end:raise ValueError('Truncated protobuf')
        yield tag>>3,wire,field_start,header_end,payload,pos
model_graph=[f for f in fields(source,0,len(source)) if f[0]==7 and f[1]==2]
if len(model_graph)!=1:raise ValueError('Expected one ModelProto.graph')
_,_,_,graph_length_start,graph_start,graph_end=model_graph[0]
changes=[];names=[]
for number,wire,start,_,payload,end in fields(source,graph_start,graph_end):
    if number!=1 or wire!=2:continue
    node=onnx.NodeProto.FromString(source[payload:end])
    if node.op_type!='ReduceL2':continue
    if node.domain or len(node.input)!=1 or len(node.output)!=1:raise ValueError('Unsupported ReduceL2')
    attributes={a.name:helper.get_attribute_value(a) for a in node.attribute}
    axes=attributes.pop('axes',None)
    if set(attributes)-{'keepdims'}:raise ValueError('Unexpected ReduceL2 attributes')
    prefix=node.name+'/nam_safe_l2';inputs=[prefix+'/square'];replacement=[]
    if axes is not None:
        replacement.append(helper.make_node('Constant',[],[prefix+'/axes'],name=prefix+'/Axes',value=helper.make_tensor(prefix+'/axes_value',TensorProto.INT64,[len(axes)],axes)))
        inputs.append(prefix+'/axes')
    replacement.extend([
        helper.make_node('Mul',[node.input[0],node.input[0]],[prefix+'/square'],name=prefix+'/Square'),
        helper.make_node('ReduceSum',inputs,[prefix+'/sum'],name=prefix+'/Sum',**attributes),
        helper.make_node('Sqrt',[prefix+'/sum'],list(node.output),name=prefix+'/Sqrt')])
    packed=b''.join(b'\x0a'+varint(len(n.SerializeToString()))+n.SerializeToString() for n in replacement)
    changes.append((start,end-start,packed));names.append(node.name)
if len(changes)!=25:raise ValueError(f'Unexpected ReduceL2 count: {len(changes)}')
new_length=graph_end-graph_start+sum(len(data)-removed for _,removed,data in changes)
changes.insert(0,(graph_length_start,graph_start-graph_length_start,varint(new_length)))
parts=[];cursor=0
for offset,removed,data in changes:parts.extend([source[cursor:offset],data]);cursor=offset+removed
parts.append(source[cursor:]);target=b''.join(parts)
onnx.checker.check_model(onnx.ModelProto.FromString(target))
patch={'version':1,'id':'beat-this-final0-webgpu-safe-l2-v1','sourceSha256':SOURCE_SHA,'sourceSize':len(source),
       'targetSha256':hashlib.sha256(target).hexdigest(),'targetSize':len(target),'reductionCount':len(names),
       'description':'25 ReduceL2 nodes decomposed into Mul(x,x), ReduceSum (same axes/keepdims), Sqrt. Weights unchanged. Avoids the observed WebGPU ReduceL2 discrepancy.',
       'nodes':names,'changes':[{'offset':offset,'remove':removed,'data':base64.b64encode(data).decode()}for offset,removed,data in changes]}
args.output.write_text(json.dumps(patch,indent=2)+'\n')
if args.patched_model:args.patched_model.write_bytes(target)
print(json.dumps({'patchSha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),'targetSha256':patch['targetSha256'],'targetSize':len(target),'reductions':len(names)},indent=2))
