#!/usr/bin/env python3
"""Diagnostic only. Requires onnx + numpy; no weights are distributed.
Usage: python extract-six-stem-network.py source.onnx output.onnx
The input is the pinned StemSplit 6s fp16-weights export, not a new model.
"""
import argparse, hashlib, json
from pathlib import Path
import onnx
from onnx import numpy_helper, TensorProto
import numpy as np

SOURCE_SHA = '7ce55792e2231c93fbf92de95f5fd5b3a5e6c89f7db690dfd693e8f1dce56869'
OUTPUTS = ['/Pad_2_output_0', '/Add_4_output_0']

def extract(source, target):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA:
        raise ValueError('Unexpected source model hash; revalidate graph names and preprocessing')
    model = onnx.load_model_from_string(raw)
    changed = 0
    def convert(tensor):
        nonlocal changed
        if tensor.data_type == TensorProto.DOUBLE:
            tensor.CopyFrom(numpy_helper.from_array(numpy_helper.to_array(tensor).astype(np.float32), tensor.name))
            changed += 1
    for tensor in model.graph.initializer:
        convert(tensor)
    for node in model.graph.node:
        for attribute in node.attribute:
            if attribute.HasField('t'):
                convert(attribute.t)
    before = len(model.graph.node)
    inferred = onnx.shape_inference.infer_shapes(model)
    result = onnx.utils.Extractor(inferred).extract_model(['mix'], OUTPUTS)
    onnx.checker.check_model(result)
    if len(result.graph.node) != 3658:
        raise ValueError('Unexpected extracted graph: do not enable without revalidation')
    onnx.save_model(result, target)
    metadata = {'sourceSha256': SOURCE_SHA, 'onnxVersion': onnx.__version__, 'doubleTensorsConverted': changed,
                'sourceNodes': before, 'networkNodes': len(result.graph.node), 'outputs': OUTPUTS,
                'outputBytes': target.stat().st_size, 'outputSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                'status': 'diagnostic only; needs SixStemReconstruction.js; not enabled in catalog'}
    target.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n')
    return metadata

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path);parser.add_argument('target', type=Path)
    args=parser.parse_args();print(json.dumps(extract(args.source,args.target),indent=2))
