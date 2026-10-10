import {initializeWamHost} from './shared/sdk.js';
const $=id=>document.getElementById(id);
let context, group, source, output, plugin, gui, saved, fileURL, busy=false;
function status(message){$('status').textContent=message;}
async function initialize(){
  if(!context){
    context=new AudioContext(); await context.resume();
    [group]=await initializeWamHost(context);
    source=context.createMediaElementSource($('player'));
    output=context.createGain();output.gain.value=10**(Number($('volume').value)/20);output.connect(context.destination);
  }
  await context.resume();
}
$('load').onclick=async()=>{
  if(busy)return;busy=true;$('load').disabled=true;$('amp').disabled=true;
  const slug=$('amp').value;let next;
  try{
    status('Loading amplifier and impulses…');await initialize();
    const {default:Plugin}=await import(`./${slug}/index.js`);
    next=await Plugin.createInstance(group,context);const nextGui=await next.createGui();
    $('player').pause();source.disconnect();
    if(plugin)await plugin.audioNode.destroy();
    plugin=next;next=null;gui=nextGui;
    source.connect(plugin.audioNode);plugin.audioNode.connect(output);
    $('mount').replaceChildren(gui);$('save').disabled=false;$('editor').disabled=false;$('editor').textContent='Hide editor';
    $('restore').disabled=!saved||saved.plugin!==slug;
    status(`${plugin.name} ready. Choose a preset in the amplifier, then press Play.`);
  }catch(error){console.error(error);await next?.audioNode.destroy();status(error.message);}
  finally{busy=false;$('load').disabled=false;$('amp').disabled=false;}
};
$('player').addEventListener('play',async()=>{if(!plugin){$('player').pause();status('Load an amplifier first.');return;}await initialize();});
$('volume').oninput=()=>{const db=Number($('volume').value);$('volumeValue').textContent=`${db} dB`;output?.gain.setTargetAtTime(10**(db/20),context.currentTime,.01);};
$('file').onchange=()=>{const file=$('file').files[0];if(!file)return;$('player').pause();if(fileURL)URL.revokeObjectURL(fileURL);fileURL=URL.createObjectURL(file);$('player').src=fileURL;status(`Audio: ${file.name}`);};
$('sample').onclick=()=>{$('player').pause();if(fileURL)URL.revokeObjectURL(fileURL);fileURL=null;$('file').value='';$('player').src='../utility/GuitarRiffDry.mp3';status('Bundled dry guitar selected.');};
$('save').onclick=async()=>{try{saved=await plugin.audioNode.getState();$('restore').disabled=false;status('Current amplifier state saved in memory.');}catch(e){status(e.message);}};
$('restore').onclick=async()=>{try{await plugin.audioNode.setState(saved);status('Saved amplifier state restored.');}catch(e){status(e.message);}};
$('editor').onclick=()=>{if(gui.isConnected){gui.remove();$('editor').textContent='Show editor';}else{$('mount').append(gui);$('editor').textContent='Hide editor';}};
window.addEventListener('pagehide',()=>{plugin?.audioNode.destroy();context?.close();if(fileURL)URL.revokeObjectURL(fileURL);});
