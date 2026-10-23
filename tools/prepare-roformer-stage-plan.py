#!/usr/bin/env python3
"""Build a byte-range partition plan for the pinned SW ONNX (onnx 1.19.1).
No weights are republished: stages are rebuilt from the verified cached model
inside its Worker. Run in /tmp/nam-latency-export, used by the audio audit.
"""
import argparse, base64, hashlib, json, pathlib, re
import onnx

SOURCE_SHA = 'd3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444'

def fields(data, start=0, end=None):
    end = len(data) if end is None else end
    def varint(pos):
        value = shift = 0
        while pos < end:
            b = data[pos]; pos += 1; value |= (b & 127) << shift
            if b < 128: return value, pos
            shift += 7
        raise ValueError('Truncated protobuf')
    while start < end:
        offset = start; tag, start = varint(start); wire = tag & 7
        if wire == 2:
            size, payload = varint(start); start = payload + size
        elif wire == 0:
            _, start = varint(start); payload = start
        elif wire in (1, 5):
            payload = start; start += 8 if wire == 1 else 4
        else: raise ValueError(f'Unsupported protobuf wire {wire}')
        yield tag >> 3, offset, start - offset, payload, start

def stage_ranges(real, size, alignment):
    if alignment == 'uniform': return [(start, min(len(real), start + size)) for start in range(0, len(real), size)]
    ends = [i + 1 for i, (n, _) in enumerate(real) if re.fullmatch(r'/layers\.\d+\.\d+/Add_1', n.name)]
    if len(ends) != 24: raise ValueError('Unexpected transformer architecture')
    first = next(i for i, (n, _) in enumerate(real) if n.name.startswith('/layers.0.0/'))
    cuts = sorted({0, *range(0, first, size), first, *ends, *range(ends[-1], len(real), size), len(real)})
    return list(zip(cuts, cuts[1:]))

def build(source, target, size=400, alignment='uniform'):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA: raise ValueError('Unexpected weights')
    original = onnx.load_model_from_string(raw)
    model = onnx.shape_inference.infer_shapes(original)
    top = list(fields(raw)); graph = next(f for f in top if f[0] == 7)
    graph_fields = list(fields(raw, graph[3], graph[4]))
    assert [n.SerializeToString() for n in model.graph.node] == [n.SerializeToString() for n in original.graph.node]
    assert [n.SerializeToString() for n in model.graph.initializer] == [n.SerializeToString() for n in original.graph.initializer]
    node_spans = [[p, n] for field, p, n, _, _ in graph_fields if field == 1]
    init_spans = [[p, n] for field, p, n, _, _ in graph_fields if field == 5]
    # Protobuf repeated containers do not promise stable Python wrapper identity.
    by_output = {n.output[0]: (n, node_spans[i]) for i, n in enumerate(model.graph.node)}
    constants = {s: v for s, v in by_output.items() if v[0].op_type == 'Constant'}
    initial = {n.name: (n, init_spans[i]) for i, n in enumerate(model.graph.initializer)}
    values = {v.name: v for v in [*model.graph.value_info, *model.graph.input, *model.graph.output]}
    real = [(n, node_spans[i]) for i, n in enumerate(model.graph.node) if n.op_type != 'Constant']
    last = {s: i for i, (n, _) in enumerate(real) for s in n.input}
    for v in model.graph.output: last[v.name] = len(real)
    stages = []
    for start, end in stage_ranges(real, size, alignment):
        group = real[start:end]
        used = {s for n, _ in group for s in n.input if s}; made = {s for n, _ in group for s in n.output}
        inputs = sorted(used - made - initial.keys() - constants.keys())
        outputs = sorted(s for s in made if last.get(s, -1) >= end)
        metadata = lambda names: [base64.b64encode(values[s].SerializeToString()).decode() for s in names]
        stages.append(dict(
            spans=[constants[s][1] for s in sorted(used & constants.keys())] + [span for _, span in group] + [initial[s][1] for s in sorted(used & initial.keys())],
            inputs=inputs, outputs=outputs, inputMetadata=metadata(inputs), outputMetadata=metadata(outputs),
            gpuOutputs=[s for s in outputs if values[s].type.tensor_type.elem_type in [1, 10] and s not in {'out_spec_real', 'out_spec_imag'}],
            valueMetadata=metadata(sorted(made - set(outputs)))
        ))
    plan = dict(version=1, sourceSha256=SOURCE_SHA, sourceBytes=len(raw), nodesPerStage=size, alignment=alignment,
                headerSpans=[[p, n] for field, p, n, _, _ in top if field != 7],
                outputNames=[v.name for v in model.graph.output], stages=stages)
    target.write_text(json.dumps(plan, separators=(',', ':')) + '\n')
    print(f'{len(stages)} stages, {target.stat().st_size} bytes; original weights unchanged')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=pathlib.Path, default=pathlib.Path('examples/wam/source-separation/model-assets/bs_roformer_sw_6stem_fp16.onnx'))
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('examples/wam/source-separation/research/roformer-stage-plan.json'))
    parser.add_argument('--nodes-per-stage', type=int, default=400)
    parser.add_argument('--alignment', choices=['uniform', 'transformer'], default='uniform')
    args = parser.parse_args()
    if not 50 <= args.nodes_per_stage <= 1000: parser.error('nodes-per-stage must be between 50 and 1000')
    build(args.source, args.output, args.nodes_per_stage, args.alignment)
