const distribution=new URL(location).searchParams.has('dist');
const pluginBase=new URL(distribution?'../../../../dist/wasabi-amps/':'./',import.meta.url);
const {initializeWamHost}=await import(new URL(distribution?'blues/shared/sdk.js':'shared/sdk.js',pluginBase));
const $=id=>document.getElementById(id), results={distribution,checks:[]};
const pause=()=>new Promise(r=>setTimeout(r,80));
function check(name,pass){results.checks.push({name,pass});$('results').textContent+=`${pass?'PASS':'FAIL'} ${name}\n`;if(!pass)throw Error(name);}
$('run').onclick=async()=>{
  $('run').disabled=true;results.checks=[];$('results').textContent='';
  const context=new AudioContext();await context.resume();
  try{
    const [group]=await initializeWamHost(context);
    for(const slug of ['blues','cleanfull','modernmetal']){
      const {default:Plugin}=await import(new URL(`${slug}/index.js`,pluginBase)),plugin=await Plugin.createInstance(group,context),node=plugin.audioNode;
      try{
        const doc=new DOMParser().parseFromString(await(await fetch(`../${slug}/main.html`)).text(),'text/html');
        const expected=[...doc.querySelector('template').content.querySelector('#menuPresets').options].map(o=>({id:`factory-${o.value}`,name:o.text}));
        check(`${slug} original menu API/order/labels`,JSON.stringify(node.getFactoryPresets())===JSON.stringify(expected));
        const before=await node.getState(),gui=await plugin.createGui();$('editors').append(gui);await pause();await document.fonts.ready;
        const root=gui.shadowRoot,knob=root.querySelector('#reverb wap2-webaudio-knob');
        check(`${slug} original menu GUI`,JSON.stringify([...root.querySelector('#menuPresets').options].map(o=>({id:o.value,name:o.text})))===JSON.stringify(expected));
        check(`${slug} initial sound unchanged / reverb display`,JSON.stringify(await node.getState())===JSON.stringify(before)&&Math.abs(knob.value-before.parameterValues.reverb/0.4)<.011);
        for(const preset of expected){
          await node.loadFactoryPreset(preset.id);const state=await node.getState();gui.remove();$('editors').append(gui);await pause();
          check(`${slug} ${preset.id} reverb and preset unchanged`,Number(node.presetData.RG)===state.parameterValues.reverb&&JSON.stringify(await node.getState())===JSON.stringify(state)&&Math.abs(knob.value-state.parameterValues.reverb/0.4)<.011);
        }
        for(const [display,internal] of [[0,0],[5,2],[10,4]]){
          knob.setValue(display,true);await pause();
          check(`${slug} reverb display ${display} -> DSP ${internal}`,Math.abs(node.engine.params.reverb-internal)<1e-5&&Math.abs((await node.getState()).parameterValues.reverb-internal)<1e-5);
        }
        await node.setState(before);await pause();check(`${slug} restore original reverb`,JSON.stringify(await node.getState())===JSON.stringify(before));
        await node.setParamValue('reverb',7);await pause();check(`${slug} legacy state/automation range preserved`,node.engine.params.reverb===7&&knob.value===10);await node.setState(before);
        check(`${slug} vertical cursor on all knobs`,[...root.querySelectorAll('wap2-webaudio-knob')].every(k=>getComputedStyle(k).cursor==='ns-resize'&&getComputedStyle(k.querySelector('.wap2-webaudio-knob-body')).cursor==='ns-resize'));
        if(distribution){
          const oscillator=context.createOscillator(),trim=context.createGain(),analyser=context.createAnalyser(),silent=context.createGain();
          trim.gain.value=.01;silent.gain.value=0;
          oscillator.connect(trim);trim.connect(node);node.connect(analyser);analyser.connect(silent);silent.connect(context.destination);oscillator.start();
          await new Promise(r=>setTimeout(r,1300));const signal=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(signal);
          oscillator.stop();oscillator.disconnect();trim.disconnect();node.disconnect(analyser);analyser.disconnect();silent.disconnect();
          check(`${slug} standalone distribution produces finite non-silent audio`,signal.every(Number.isFinite)&&signal.some(v=>Math.abs(v)>1e-7));
        }
        const families={blues:['VastShadow','Bellerose'],cleanfull:['shady_laneregular'],modernmetal:['metalfont2','metalfont']}[slug];
        check(`${slug} original font files loaded`,families.every(f=>[...document.fonts].some(face=>face.family===`wap2-${slug}-${f}`&&face.status==='loaded')));
        check(`${slug} title and knob label fonts applied`,getComputedStyle(root.querySelector('#label_713')).fontFamily.includes(`wap2-${slug}-${families[0]}`)&&getComputedStyle(root.querySelector('#volume > div')).fontFamily.includes(`wap2-${slug}-${families.at(-1)}`));
        check(`${slug} original background corners`,getComputedStyle(root.querySelector('#background-image')).borderTopLeftRadius==='10px');
        check(`${slug} original preset menu width`,root.querySelector('#menuPresets').getBoundingClientRect().width==={blues:70,cleanfull:120,modernmetal:100}[slug]);
        const menu=root.querySelector('#menuPresets').getBoundingClientRect(),title=root.querySelector('#label_713').getBoundingClientRect(),toggle=root.querySelector('.switchCont').getBoundingClientRect();
        const cy=r=>(r.top+r.bottom)/2;
        check(`${slug} footer horizontal/vertical alignment`,Math.abs((title.left+title.right)/2-(menu.right+toggle.left)/2)<1&&Math.abs(cy(title)-cy(menu))<1&&Math.abs(cy(title)-cy(toggle))<1&&title.width>=root.querySelector('#label_713').scrollWidth);
      }finally{await node.destroy();}
    }
    results.pass=true;$('status').textContent=`Passed: ${results.checks.length} editor checks.`;
  }catch(error){results.pass=false;results.error=error.stack;$('status').textContent='FAILED: '+error.message;}
  finally{await context.close();results.date=new Date().toISOString();$('download').disabled=false;$('run').disabled=false;}
};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(results,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=distribution?'VALIDATION_DIST.json':'VALIDATION_UI.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
