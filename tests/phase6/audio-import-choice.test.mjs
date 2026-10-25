import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAudioFile} from '../../examples/wam/source-separation/AudioImportChoice.js';
test('choosing a local file closes the import chooser before opening the native picker synchronously',()=>{
 const menu={open:true},events=[];
 const input={disabled:false,click(){events.push('picker');assert.equal(menu.open,false);}};
 assert.equal(chooseAudioFile(menu,input),true);assert.deepEqual(events,['picker']);
});
test('a disabled file input does not open a picker or hide the other import option',()=>{
 const menu={open:true};let clicked=false;
 assert.equal(chooseAudioFile(menu,{disabled:true,click(){clicked=true;}}),false);
 assert.equal(clicked,false);assert.equal(menu.open,true);
});
