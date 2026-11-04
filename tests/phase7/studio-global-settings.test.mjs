import test from 'node:test';
import assert from 'node:assert/strict';
import {registerStudioSettings} from '../../examples/wam/projects/StudioSettings.js';

test('Studio and Recording shortcuts use the same global settings with the original live control panels',()=>{
 const sections=[],opened=[],settings={addSection:s=>sections.push(s),open:id=>opened.push(id)};
 const projectPanel={id:'studioOptionsPanel'},recordPanel={id:'recordOptionsPanel'},projectButton={},recordButton={};
 registerStudioSettings({settings,projectPanel,recordPanel,projectButton,recordButton});
 assert.equal(sections[0].element,projectPanel);assert.equal(sections[1].element,recordPanel);
 assert.deepEqual(sections.map(s=>s.id),['studio','recording']);
 projectButton.onclick();recordButton.onclick();assert.deepEqual(opened,['studio','recording']);
});
