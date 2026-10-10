"""Reproduce the native-engine import; does not modify the WAP sources."""
from pathlib import Path
import re, json, hashlib, shutil, html
root = Path(__file__).resolve().parents[1]
source = root.parent
repo = source.parents[2]
manifest = {}

def replace_function(text, name, body):
    m = re.search(r'function '+name+r'\([^)]*\)\s*\{', text)
    if not m: raise ValueError(name)
    start=m.end(); level=1; i=start
    while level:
        if text[i]=='{': level+=1
        elif text[i]=='}': level-=1
        i+=1
    return text[:start]+'\n'+body+'\n  '+text[i-1:]

for slug, classname in [('blues','BluesMachine'),('cleanfull','CleanMachineFull'),('modernmetal','ModernMetalMachine')]:
    dest=root/slug; dest.mkdir(exist_ok=True)
    original=(source/slug/'main.js').read_text()
    manifest[str(Path(slug)/'main.js')]=hashlib.sha256(original.encode()).hexdigest()
    text=original.split('window.Wasabi')[0]
    text=text.replace(f'window.{classname} = class {classname} extends WebAudioPluginCompositeNode',f'export default class {classname} extends NativeEngine')
    text="// Imported native DSP. See ../README.md and ../tools/import-wap.py for adaptations.\nimport {NativeEngine, queueImpulse} from '../shared/engine.js';\n"+text
    text=text.replace('this.URL + "assets/','this.URL + "/assets/')
    text=text.replace('this.amp.changeLowShelf3FrequencyValue = val;','this.amp.changeLowShelf3FrequencyValue(val);')
    text=re.sub(r'^(\s*)preset(\d+) =',r'\1var preset\2 =',text,flags=re.M)
    text=replace_function(text,'loadImpulseByUrl', '    return queueImpulse(context, convolverNode, inputGain, url, '+('0.5' if slug=='blues' else '1')+');')
    text=text.replace('name = cabinet.IRs[0].name;','name = cabinetSim.IRs[0].name;')
    if slug=='modernmetal':
        text=text.replace('    presets: presets,','    presets: presets,\n    setPreset: setValuesFromPreset,')
        text=text.replace('    this.extraStages = [];', '    this.extraStages = [];\n    this.extraStageNodes = [];')
        text=text.replace('    this.addToGraph(this.od[num], highPassNew, lowShelfNew, ctrlGain, output);', '    this.extraStageNodes.push([this.od[num], highPassNew, lowShelfNew, ctrlGain]);\n    this.addToGraph(this.od[num], highPassNew, lowShelfNew, ctrlGain, output);')
        text=text.replace('    this.extraStages.pop();', '    this.extraStages.pop();\n    for (const node of this.extraStageNodes.pop()) { node.disconnect(); this.context.resources.nodes.delete(node); }\n    delete this.od[num];')
    (dest/'Engine.js').write_text(text)
    shutil.copytree(source/slug/'assets',dest/'assets',dirs_exist_ok=True)
    h=(source/slug/'main.html').read_text()
    menu=re.search(r'<select id="menuPresets"[^>]*>(.*?)</select>',h,re.S)[1]
    preset_menu=[{'id':'factory-'+index,'name':html.unescape(label.strip())} for index,label in re.findall(r'<option\s+value=["\']?(\d+)[^>]*>(.*?)</option>',menu,re.S)]
    (dest/'preset-menu.js').write_text('export default '+json.dumps(preset_menu)+';\n')
    template=re.search(r'<template[^>]*>(.*?)</template>',h,re.S)[1]
    fonts=''.join(re.findall(r'<style>(.*?)</style>',h.split('<template')[0],re.S))
    template='<style>'+fonts+'</style>'+template
    template=template.replace('webaudio-knob','wap2-webaudio-knob').replace('webaudio-switch','wap2-webaudio-switch')
    template=re.sub(r'\s*midilearn="1"','',template)
    (dest/'template.js').write_text('export default '+json.dumps(template)+';\n')
    descriptor={'identifier':'fr.wasabi.wam2.'+slug,'name':{'blues':'Blues Machine','cleanfull':'Clean Machine Full','modernmetal':'Modern Metal Machine'}[slug], 'vendor':'Wasabi / Michel Buffa','description':'Native Web Audio amplifier migrated from WAP, with cabinet and reverb.','version':'1.0.0','apiVersion':'2.0.0','category':'amplifier','keywords':['amplifier','guitar','cabinet','reverb'],'isInstrument':False,'hasAudioInput':True,'hasAudioOutput':True,'hasMidiInput':False,'hasMidiOutput':False,'hasMpeInput':False,'hasMpeOutput':False,'hasOscInput':False,'hasOscOutput':False,'hasSysexInput':False,'hasSysexOutput':False,'hasAutomationInput':True,'hasAutomationOutput':False,'thumbnail':'assets/thumbnail.png'}
    (dest/'descriptor.json').write_text(json.dumps(descriptor,indent=2)+'\n')
    (dest/'index.js').write_text("import {createAmpModule} from '../shared/plugin.js';\nimport Engine from './Engine.js';\nimport presetMenu from './preset-menu.js';\nexport default createAmpModule("+json.dumps(slug)+", Engine, new URL('./', import.meta.url), presetMenu);\n")

# Pin the locally audited bundled SDKs (the ParamMgr destroy acknowledgement fix is included).
for src, dest in [('sdk/index.js','sdk.js'),('sdk-parammgr/index.js','parammgr.js')]:
    p=repo/'examples/wam/wamPlugins/EndUserAmp1'/src
    data=p.read_bytes(); (root/'shared'/dest).write_bytes(data)
    manifest['EndUserAmp1/'+src]=hashlib.sha256(data).hexdigest()
p=repo/'examples/wam/wamPlugins/EndUserAmp1/utils/webaudio-controls.js'
text=p.read_text().replace('ifc-webaudio-','wap2-webaudio-').replace('webaudioctrl-context-menu','wap2-webaudioctrl-context-menu')
text=text.replace('if (window.WebAudioControlsOptions)\n\t\tObject.assign(opt, window.WebAudioControlsOptions);','// This plugin family does not request Web MIDI access.')
text=text.replace('if (window.UseWebAudioControlsMidi || opt.useMidi)','if (false)')
(root/'shared/controls.js').write_text(text)
manifest['EndUserAmp1/utils/webaudio-controls.js']=hashlib.sha256(p.read_bytes()).hexdigest()
(root/'SOURCE_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
