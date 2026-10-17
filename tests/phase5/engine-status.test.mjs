import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineStatus} from '../../examples/wam/EngineStatus.js';

const fakeElement = () => {
  const attributes = new Map();
  return {dataset: {}, textContent: '', title: '', attributes,
    setAttribute: (name, value) => attributes.set(name, value),
    toggleAttribute: (name, force) => (force ? attributes.set(name, '') : attributes.delete(name))};
};

test('the engine badge follows the rack start-up, then the AudioContext state', () => {
  const context = Object.assign(new EventTarget(), {state: 'suspended', sampleRate: 48000});
  const element = fakeElement();
  const engine = new EngineStatus({element, context});
  assert.equal(element.dataset.state, 'starting');
  assert.equal(element.textContent, 'Starting audio engine…');

  engine.ready();
  assert.deepEqual([element.dataset.state, element.attributes.get('tone')], ['idle', 'neutral']);

  context.state = 'running';
  context.dispatchEvent(new Event('statechange'));
  assert.equal(element.dataset.state, 'ready');
  assert.equal(element.textContent, 'Audio engine ready · 48 kHz');
  assert.ok(element.attributes.has('live'));

  context.state = 'interrupted';
  context.dispatchEvent(new Event('statechange'));
  assert.deepEqual([element.dataset.state, element.textContent], ['offline', 'Audio engine offline']);
});

test('a rack that fails to start shows the engine offline', () => {
  const element = fakeElement();
  new EngineStatus({element, context: Object.assign(new EventTarget(), {state: 'running', sampleRate: 48000})}).fail();
  assert.equal(element.dataset.state, 'offline');
});
