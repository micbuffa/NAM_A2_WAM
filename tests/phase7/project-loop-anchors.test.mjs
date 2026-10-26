import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeLoop} from '../../examples/wam/projects/ProjectsModel.js';
import {ProjectTimeline} from '../../examples/wam/projects/ProjectTimeline.js';

const length = {bars:16,seconds:32};
test('A/B resizing preserves the opposite boundary, snaps to bars and clamps without crossing', () => {
  const loop={start:4,end:16};
  assert.deepEqual(resizeLoop(loop,'A',9,length),{start:10,end:16});
  assert.deepEqual(resizeLoop(loop,'B',23,length),{start:4,end:24});
  assert.deepEqual(resizeLoop(loop,'A',9.3,length,{free:true}),{start:9.3,end:16});
  assert.deepEqual(resizeLoop(loop,'B',17.7,length,{free:true}),{start:4,end:17.7});
  assert.deepEqual(resizeLoop(loop,'A',99,length),{start:15.95,end:16});
  assert.deepEqual(resizeLoop(loop,'B',-9,length),{start:4,end:4.05});
  assert.deepEqual(resizeLoop(loop,'A',-9,length),{start:0,end:16});
  assert.deepEqual(resizeLoop({start:0,end:0},'B',12,length),{start:0,end:12});
  assert.deepEqual(loop,{start:4,end:16});
});

class Node {
  constructor() {
    this.children=[];this.dataset={};this.attributes={};this.events={};this.clientWidth=320;
    const classes=new Set();this.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name)};
    this.style={setProperty:(key,value)=>{this.style[key]=value;}};
  }
  get childElementCount(){return this.children.length;}
  addEventListener(type,listener){this.events[type]=listener;}
  setAttribute(key,value){this.attributes[key]=value;}
  replaceChildren(...children){this.children=children;}
  getBoundingClientRect(){return {left:100,width:320};}
  setPointerCapture(){}
  closest(){return this.dataset.loopAnchor?this:null;}
}
function fixture(run) {
  const original=globalThis.document;
  globalThis.document={createElement:()=>new Node()};
  try {
    const root=new Node(),ruler=new Node(),list=new Node(),commits=[],seeks=[];
    const timeline=new ProjectTimeline(list,{root,ruler,onSeek:time=>seeks.push(time),onLoop:loop=>{
      commits.push(loop);timeline.setLoop({enabled:true,...loop});
    }});
    timeline.setLength(length);timeline.setLoop({enabled:true,start:4,end:16});
    const pointer=(type,clientX,{target=ruler,altKey=false,pointerId=1}={})=>ruler.events[type]({button:0,clientX,target,altKey,pointerId});
    return run({timeline,root,ruler,commits,seeks,pointer});
  } finally {globalThis.document=original;}
}

test('dragging A previews then commits with no seek, no grab-position jump and no second pointer takeover',()=>fixture(({timeline,root,commits,seeks,pointer})=>{
  const [a]=timeline.anchors;
  pointer('pointerdown',145,{target:a}); // boundary at140, grabbed5px into the tab
  pointer('pointermove',185,{pointerId:2});assert.equal(commits.length,0);
  pointer('pointermove',185);assert.equal(root.style['--loop-start'],'0.25');
  assert.equal(a.attributes['aria-valuenow'],'8');assert.equal(commits.length,0);
  pointer('pointerup',185);assert.deepEqual(commits,[{start:8,end:16}]);assert.deepEqual(seeks,[]);
}));

test('B precise resizing, pointer cancellation and capture loss restore the saved boundary',()=>fixture(({timeline,commits,pointer})=>{
  const b=timeline.anchors[1];
  pointer('pointerdown',255,{target:b}); // boundary260, grabbed5px left of it
  pointer('pointermove',282,{altKey:true});pointer('pointerup',282,{altKey:true});
  assert.deepEqual(commits,[{start:4,end:18.7}]);
  pointer('pointerdown',282,{target:b});pointer('pointermove',190);
  pointer('pointercancel',190);assert.equal(b.attributes['aria-valuenow'],'18.7');assert.equal(commits.length,1);
  pointer('pointerdown',282,{target:b});pointer('pointermove',200);pointer('lostpointercapture',200);
  assert.equal(timeline.loopDrag,null);assert.equal(b.attributes['aria-valuenow'],'18.7');assert.equal(commits.length,1);
}));

test('A/B keyboard resizing activates the loop; ruler clicks and drawing keep working; anchors survive redraws',()=>fixture(({timeline,ruler,commits,seeks,pointer})=>{
  const [a,b]=timeline.anchors;
  const key=(anchor,key,altKey=false)=>anchor.onkeydown({key,altKey,preventDefault(){},stopPropagation(){}});
  key(a,'ArrowRight');assert.deepEqual(commits.at(-1),{start:6,end:16});
  key(b,'ArrowLeft',true);assert.deepEqual(commits.at(-1),{start:6,end:15.9});
  key(a,'Home');assert.equal(commits.at(-1).start,0);
  key(b,'End');assert.equal(commits.at(-1).end,32);
  timeline.setLoop({enabled:false,start:0,end:0});key(b,'ArrowLeft');
  assert.deepEqual(commits.at(-1),{start:0,end:30});
  assert.equal(timeline.loop.enabled,true);
  pointer('pointerdown',180);pointer('pointerup',180);assert.deepEqual(seeks,[8]);
  pointer('pointerdown',145);pointer('pointermove',205);pointer('pointerup',205);
  assert.deepEqual(commits.at(-1),{start:4,end:12});
  timeline.renderRuler();assert.ok(ruler.children.includes(a));assert.ok(ruler.children.includes(b));
  assert.equal(a.attributes['aria-label'],'Loop start A');assert.equal(b.attributes['aria-label'],'Loop end B');
}));
