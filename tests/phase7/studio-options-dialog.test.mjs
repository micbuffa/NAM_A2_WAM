import test from 'node:test';
import assert from 'node:assert/strict';
import {StudioOptionsDialog} from '../../examples/wam/projects/StudioOptionsDialog.js';
function setup(){
 const button=Object.assign(new EventTarget(),{isConnected:true,focus(){this.focused=true;}}),workspaces=new EventTarget(),workspace=new EventTarget();
 const next={},parent={insertBefore(node,position){assert.equal(position,next);node.parentNode=this;this.restored=node;}};
 const panel={parentNode:parent,nextSibling:next,hidden:true,operation:'separating',onchange:()=>{}},handler=panel.onchange;let count=0;
 const dialogs=new StudioOptionsDialog({button,panel,title:'Project options',workspaces,workspace,create:()=>{
  count++;const dialog=Object.assign(new EventTarget(),{showModal(){this.open=true;},close(){this.open=false;this.dispatchEvent(new Event('close'));}});
  const body={append(node){this.node=node;node.parentNode=this;}};return{dialog,body};
 }});
 return{dialogs,button,panel,handler,parent,workspace,workspaces,count:()=>count};
}
test('secondary options move the same bound controls into a modal; closing restores controls and focus without stopping operation',()=>{
 const f=setup();f.button.dispatchEvent(new Event('click'));const modal=f.dialogs.dialog;
 assert.ok(modal.open);assert.equal(f.panel.hidden,false);assert.equal(f.panel.onchange,f.handler);
 f.dialogs.show();assert.equal(f.count(),1);modal.close();assert.equal(f.panel.hidden,true);assert.equal(f.parent.restored,f.panel);assert.equal(f.button.focused,true);assert.equal(f.panel.operation,'separating');
 f.dialogs.show();assert.equal(f.count(),2);assert.equal(f.panel.onchange,f.handler);f.dialogs.destroy();assert.equal(f.panel.hidden,true);
});
test('options close on workspace/account changes and release their bindings on disposal',()=>{
 const f=setup();for(const target of [f.workspace,f.workspaces]){f.dialogs.show();target.dispatchEvent(new Event('change'));assert.equal(f.dialogs.dialog,null);}
 f.button.disabled=true;f.dialogs.show();assert.equal(f.dialogs.dialog,null);f.button.disabled=false;f.dialogs.destroy();f.button.dispatchEvent(new Event('click'));assert.equal(f.dialogs.dialog,null);
});
