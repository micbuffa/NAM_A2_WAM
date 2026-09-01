#!/usr/bin/env python3
import array, math, sys

def load(path):
    values = array.array('f')
    with open(path, 'rb') as stream: values.fromfile(stream, 48000)
    return values

a, b = load(sys.argv[1]), load(sys.argv[2])
errors = [float(x) - float(y) for x, y in zip(a, b)]
maximum = max(abs(x) for x in errors)
rms = math.sqrt(sum(x*x for x in errors) / len(errors))
signal_rms = math.sqrt(sum(float(x)*float(x) for x in a) / len(a))
relative = rms / signal_rms if signal_rms else 0.0
print(f'max_abs_error={maximum:.9g} rms_error={rms:.9g} relative_rms_error={relative:.9g}')
if maximum > 2e-5: raise SystemExit(1)

