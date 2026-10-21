import test from 'node:test';
import assert from 'node:assert/strict';
import {factoryImageFor} from '../../src/shared/defaultAssets.js';

const manifest = {assets: [
  {id: 'factory:tone3000/a/Cab--t1/captures/V30.wav', filename: 'V30.wav', imagePath: 'tone3000/a/Cab--t1/cover.jpg'},
  {id: 'factory:tone3000/b/Bare.wav', filename: 'Bare.wav'},
]};
const fetchManifest = () => Promise.resolve({ok: true, json: async () => manifest});

test('Factory pictures resolve from the current manifest, by identity then by file name', async () => {
  const url = 'https://rack.test/src/cabinet-wam/irs-manifest.json';
  assert.equal(await factoryImageFor(url, 'IRs', {identity: 'factory:tone3000/a/Cab--t1/captures/V30.wav'}, fetchManifest),
    'https://rack.test/src/cabinet-wam/IRs/tone3000/a/Cab--t1/cover.jpg');
  // A preset saved without the identity still finds its picture through the file name.
  assert.equal(await factoryImageFor(url, 'IRs', {filename: 'V30.wav'}, fetchManifest),
    'https://rack.test/src/cabinet-wam/IRs/tone3000/a/Cab--t1/cover.jpg');
  assert.equal(await factoryImageFor(url, 'IRs', {filename: 'Bare.wav'}, fetchManifest), '');
  assert.equal(await factoryImageFor(url, 'IRs', {identity: 'tone3000:42', filename: 'download.wav'}, fetchManifest), '');
});

test('an unreachable manifest yields no Factory picture and is fetched again later', async () => {
  const url = 'https://rack.test/unreachable/irs-manifest.json';
  let calls = 0;
  const failing = () => { calls += 1; return Promise.reject(new Error('offline')); };
  assert.equal(await factoryImageFor(url, 'IRs', {filename: 'V30.wav'}, failing), '');
  assert.equal(await factoryImageFor(url, 'IRs', {filename: 'V30.wav'}, failing), '');
  assert.equal(calls, 2);
});
