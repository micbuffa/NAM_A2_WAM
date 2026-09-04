import test from 'node:test';
import assert from 'node:assert/strict';
import {factoryAssetUrl} from '../../src/shared/assetBrowser.js';

test('Factory asset URLs preserve special filename characters as path data', () => {
  const base=new URL('https://example.test/plugins/nam-wam/models-manifest.json');
  const url=factoryAssetUrl(base,'models','tone3000/Auteur français/Blend #1? bright.nam');
  assert.equal(url.href,'https://example.test/plugins/nam-wam/models/tone3000/Auteur%20fran%C3%A7ais/Blend%20%231%3F%20bright.nam');
  assert.equal(url.hash,'');
  assert.equal(url.search,'');
});

test('Factory asset URLs reject traversal and empty path segments', () => {
  const base=new URL('https://example.test/plugins/nam-wam/models-manifest.json');
  assert.throws(()=>factoryAssetUrl(base,'models','../outside.nam'),/Invalid Factory asset path/u);
  assert.throws(()=>factoryAssetUrl(base,'models','folder//model.nam'),/Invalid Factory asset path/u);
});
