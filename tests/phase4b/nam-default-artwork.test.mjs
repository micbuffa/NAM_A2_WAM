import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadDefaultAsset} from '../../src/shared/defaultAssets.js';
import {getToneImageUrl} from '../../src/shared/toneArtwork.js';

test('a new NAM instance selects the exact clean Deluxe Reverb capture, not the first capture in its pack',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../src/nam-wam/models-manifest.json',import.meta.url),'utf8'));
 let loaded;const requests=[],node={getState:()=>({}),loadModelText:(...args)=>loaded=args};
 await loadDefaultAsset(node,'nam','https://rack.test/plugins/nam-wam/models-manifest.json',async url=>{
  requests.push(String(url));return String(url).endsWith('json')?{ok:true,json:async()=>manifest}:{ok:true,text:async()=>'NAM contents'};
 });
 assert.match(loaded[1],/^NEW VERSION Fender DRRI Clean SM57 \+ Royer R-121 \(No Room\) Full Rig--m383469\.nam$/);
 assert.equal(loaded[2].toneId,51649);assert.equal(loaded[2].modelId,383469);assert.equal(loaded[2].title,"Deluxe Reverb '65 Reissue Clean");
 assert.equal(requests.length,2);assert.match(decodeURIComponent(requests[1]),/383469/);assert.match(loaded[2].imageUrl,/cover\.jpg$/);
});
test('Tone3000 artwork normalizes catalogue strings, objects and callback fields, rejecting non-image URL schemes',()=>{
 for(const input of [{images:['https://cdn.test/amp.jpg']},{images:[{url:'https://cdn.test/amp.jpg'}]},{image_url:'https://cdn.test/amp.jpg'},{imageUrl:'https://cdn.test/amp.jpg'},{image:{src:'https://cdn.test/amp.jpg'}}])assert.equal(getToneImageUrl(input),'https://cdn.test/amp.jpg');
 assert.equal(getToneImageUrl({images:['javascript:bad'],image_url:'https://cdn.test/fallback.jpg'}),'https://cdn.test/fallback.jpg');
 assert.equal(getToneImageUrl({images:['data:text/html,bad','javascript:bad']}),'');assert.equal(getToneImageUrl(null),'');
});
