import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('WAM processor directly extends WamProcessor and owns NAM inference', async () => {
  const source = await readFile('src/nam-wam/NamProcessor.js', 'utf8');
  assert.match(source, /class NamProcessor extends WamProcessor/);
  assert.match(source, /nam_process/);
  assert.doesNotMatch(source, /new AudioWorkletNode/);
});

test('host never hardcodes discovered audio filenames', async () => {
  const source = await readFile('examples/wam/main.js', 'utf8');
  assert.match(source, /\/api\/test-audio-files/);
  assert.doesNotMatch(source, /DryGuitarReference|CleanStrat|FunkDI|PalmMutes/);
});

test('production WAM path omits Phase 2 unconditional instrumentation', async () => {
  const source = await readFile('src/nam-wam/NamProcessor.js', 'utf8');
  assert.doesNotMatch(source, /Number\.isFinite\(output/);
  assert.match(source, /_diagnosticEnabled \? Date\.now\(\) : 0/);
});

test('metering preserves the single worklet and allocation-free processing body', async () => {
  const source = await readFile('src/nam-wam/NamProcessor.js', 'utf8');
  const body = source.slice(source.indexOf('    _process('), source.indexOf('    destroy()', source.indexOf('    _process(')));
  assert.doesNotMatch(body, /\bnew\s+/);
  assert.doesNotMatch(body, /Promise|console\.|JSON\.|setTimeout|setInterval/);
  assert.match(body, /_meterFrames >= this\._meterReportFrames/);
  assert.match(source, /this\._meterMessage = \{type: 'nam-meter'/);
});
