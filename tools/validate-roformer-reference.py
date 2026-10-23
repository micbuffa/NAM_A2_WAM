"""Offline SW-1 audit. Use the pinned artifacts from research/bs-roformer-sw.json.
Dependencies: numpy, onnxruntime 1.22.0 (the temporary Demucs export venv works).
This validates spectrograms only; it does not qualify browser/GPU/audio quality.
"""
from pathlib import Path
import argparse, hashlib, json, time
import numpy as np
import onnxruntime as ort


def compare(reference, output):
    delta = output.astype(np.float64) - reference.astype(np.float64)
    return {"maxAbsError": float(np.max(np.abs(delta))),
            "relativeRmsError": float(np.linalg.norm(delta) / max(np.linalg.norm(reference), 1e-12))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifacts', default='third_party/bs-roformer-audit')
    parser.add_argument('--output', default='/tmp/nam-roformer-reference.json')
    args = parser.parse_args()
    manifest = json.loads(Path('examples/wam/source-separation/research/bs-roformer-sw.json').read_text())
    folder = Path(args.artifacts)
    for f in manifest['files']:
        if 'fp32' in f['rfilename']:
            continue
        p = folder / f['rfilename']
        if p.stat().st_size != f['size'] or hashlib.sha256(p.read_bytes()).hexdigest() != f['lfs']['sha256']:
            raise ValueError('Pinned artifact integrity failed: ' + str(p))
    ref = np.load(folder / 'reference.npz', allow_pickle=False)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    started = time.perf_counter()
    session = ort.InferenceSession(str(folder / 'bs_roformer_sw_6stem_fp16.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
    load_ms = (time.perf_counter() - started) * 1000
    started = time.perf_counter()
    outputs = session.run(['out_spec_real', 'out_spec_imag'], {k: ref[k] for k in ['spec_real', 'spec_imag']})
    infer_ms = (time.perf_counter() - started) * 1000
    comparisons = []
    roles = ['bass', 'drums', 'other', 'vocals', 'guitar', 'piano']
    for k, out in zip(['out_spec_real', 'out_spec_imag'], outputs):
        assert out.shape == ref[k].shape and out.shape[1:3] == (6, 2) and np.isfinite(out).all()
        comparisons.append({'branch': k, **compare(ref[k], out), 'sources': [
            {'role': role, **compare(ref[k][:, i], out[:, i])} for i, role in enumerate(roles)]})
    report = {'scope': 'CPU spectrogram parity vs supplied third-party PyTorch reference; no browser/audio quality validation',
              'modelRevision': manifest['modelRevision'], 'runtime': ort.__version__, 'loadMs': load_ms,
              'inferMs': infer_ms,
              'inputs': {k: list(ref[k].shape) for k in ['spec_real', 'spec_imag']},
              'comparison': comparisons, 'passed': all(c['maxAbsError'] < 1e-3 for c in comparisons)}
    Path(args.output).write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2), flush=True)
    if not report['passed']:
        raise SystemExit('Spectrogram parity threshold failed (1e-3). Keep model in research.')


if __name__ == '__main__':
    main()
