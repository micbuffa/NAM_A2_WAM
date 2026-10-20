import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../examples/wam/source-separation/bootstrap.js', import.meta.url), 'utf8');
function load(protocol) {
  const elements = {runtimeNotice:{hidden:true},startupError:{hidden:true,textContent:''}};
  const sections = [{hidden:false},{hidden:false}]; const scripts = [];
  const document = {getElementById:id=>elements[id],querySelectorAll:()=>sections,createElement:()=>({}),body:{append:script=>scripts.push(script)}};
  vm.runInNewContext(source,{document,location:{protocol}});
  return {elements,sections,scripts};
}
test('file:// explains the HTTP requirement before modules load and hides unusable controls',()=>{
  const {elements,sections,scripts}=load('file:');
  assert.equal(elements.runtimeNotice.hidden,false);
  assert.ok(sections.every(section=>section.hidden));
  assert.equal(scripts.length,0);
});
test('HTTP and HTTPS start modules without showing the file notice',()=>{
  for(const protocol of ['http:','https:']) {
    const {elements,sections,scripts}=load(protocol);
    assert.equal(elements.runtimeNotice.hidden,true);assert.ok(sections.every(section=>!section.hidden));
    assert.deepEqual(scripts.map(script=>script.src),['../ui/index.js','./main.js']);
    assert.ok(scripts.every(script=>script.type==='module'));
  }
});
test('failed module loading displays an actionable startup error instead of a silent disabled app',()=>{
  const {elements,scripts}=load('http:');scripts[1].onerror();
  assert.equal(elements.startupError.hidden,false);assert.match(elements.startupError.textContent,/serveur HTTP/);
});
