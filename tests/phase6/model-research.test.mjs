import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODEL_RESEARCH_CATALOG,createModelResearchPanel} from '../../examples/wam/source-separation/ModelResearchCatalog.js';
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this.attributes[key]=value;}
}
const flatten=e=>[e,...e.children.flatMap(flatten)];
test('research focuses on instrumental multi-stem models for guitarists and bassists',()=>{
 assert.equal(MODEL_RESEARCH_CATALOG.length,3);assert.deepEqual(MODEL_RESEARCH_CATALOG.map(x=>x.id),['bs-roformer-sw','scnet-xl','mdx-extra-q']);assert.equal(new Set(MODEL_RESEARCH_CATALOG.map(x=>x.id)).size,3);
 assert.equal(MODEL_RESEARCH_CATALOG[0].id,'bs-roformer-sw');assert.match(MODEL_RESEARCH_CATALOG[0].status,/validation audio CPU\/WebGPU/);
 assert.match(MODEL_RESEARCH_CATALOG.find(x=>x.id==='scnet-xl').use,/Quatre sources/);
 assert.match(MODEL_RESEARCH_CATALOG.find(x=>x.id==='mdx-extra-q').detail,/pas de MDX-Net/);
});
test('research panel has clear availability and source links without downloads or inference controls',()=>{
 const panel=createModelResearchPanel({createElement:tag=>new Element(tag)}),nodes=flatten(panel);
 assert.equal(panel.tag,'details');assert.equal(panel.open,undefined);
 assert.equal(nodes.filter(e=>e.tag==='article').length,3);
 assert.equal(nodes.filter(e=>['button','input','select'].includes(e.tag)).length,0);
 assert.ok(nodes.some(e=>e.textContent?.includes('ne sont pas encore intégrées')));
 for(const link of nodes.filter(e=>e.tag==='a')){assert.ok(link.href.startsWith('https://'));assert.equal(link.rel,'noopener noreferrer');}
});
test('research metadata is separate from runnable/downloadable models and the Settings mounts it',async()=>{
 const base=new URL('../../examples/wam/source-separation/',import.meta.url),models=JSON.parse(await readFile(new URL('models.json',base),'utf8')).models;
 assert.ok(MODEL_RESEARCH_CATALOG.filter(r=>r.id!=='bs-roformer-sw').every(r=>!models.some(m=>m.id===r.id)));
 const host=await readFile(new URL('MultitrackPlayerElement.js',base),'utf8');
 assert.match(host,/dialog.append\(setup,createModelResearchPanel\(\),downloads\)/);
});
