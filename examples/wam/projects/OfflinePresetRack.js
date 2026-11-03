import initializeWamHost from '../../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js';
import {FxChain} from '../FxChain.js';
import {FxRack} from '../FxRack.js';
import {TrackSource} from './TrackTones.js';
import {destroyPluginInstance} from '../WamPluginRegistry.js';

const staticValue=(param,value)=>{param.cancelScheduledValues(0);param.setValueAtTime(value,0);};
// Owns only a fresh offline graph: no devices, GUI, live rack or dry fallback.
export async function createOfflinePresetRack(context,state,{registry,check=()=>{}}) {
  if(state.version!==2||!state.a?.entries)throw Error('Export needs a complete track preset.');
  if(state.visible&&!state.b)throw Error('Missing saved chain B.');
  if(state.route&&(!state.b||!Number.isInteger(state.route.index)||state.route.index<0||state.route.index>state.a.entries.length))throw Error('Invalid saved chain junction.');
  const ids=new Set();for(const entry of [...state.a.entries,...(state.b?.entries??[])]){if(!entry.id||ids.has(entry.id))throw Error('Duplicate or missing plugin instance ID.');ids.add(entry.id);}
  if(state.visible&&state.enabledB&&!state.route)throw Error('A recorded mono DI cannot supply independent inputs to two chains.');
  const[groupId]=await initializeWamHost(context);check();
  let rack;const lanes=[];const errors=[];
  const createLane=async(saved)=>{
    const lane=new FxChain({context,registry,groupId});lanes.push(lane);
    try{
      for(const item of saved.entries){
        check();let plugin,record;
        try{
          if(!item.bypass){
            record=registry.records.find(r=>r.entryUrl===new URL(item.pluginUri,registry.catalogueUrl).href);
            if(!record)throw Error(`Plugin absent from catalogue: ${item.pluginUri}`);
            if((['nam','cabinet'].includes(record.role)?record.role:'effect')!==item.kind)throw Error('Plugin kind does not match catalogue.');
            const{default:Plugin}=await registry.import(record);check();
            // Retain a handle even when initialize rejects, to release its worklet.
            plugin=new Plugin(groupId,context);await plugin.initialize(structuredClone(item.state));check();
            // Some SDK wrappers ignore initialState; explicitly restore it too.
            await plugin.audioNode.setState(structuredClone(item.state));check();
            if(item.kind==='nam')await plugin.audioNode.setModelVariant('lite'); // same as ordinary Studio playback
            plugin.audioNode.addEventListener('processorerror',()=>errors.push(`Processor failed: ${record.name}`));
          }
          lane.entries.push(lane.wrap({...item,plugin,record}));
        }catch(error){destroyPluginInstance(plugin);throw error;}
      }
      lane.reconnect();return lane;
    }catch(error){lane.destroy();lanes.splice(lanes.indexOf(lane),1);throw error;}
  };
  try{
    const a=await createLane(state.a);
    rack=new FxRack({context,a,source:new TrackSource(),createLane:()=>createLane(state.b)});
    rack.addEventListener('error',event=>errors.push(event.detail?.message||'Offline rack error'));
    if(state.visible&&state.enabledB&&state.route){await rack.ensureB();rack.visible=true;rack.enabledB=true;rack.route={...state.route};a.junction=rack.route;}
    for(const [lane,db]of [[a,state.outputDbA??0],[rack.b,state.outputDbB??0]])if(lane){if(!Number.isFinite(db)||db < -48||db>12)throw Error('Invalid lane output gain');lane.outputDb=db;staticValue(lane.output.gain,10**(db/20));}
    rack.mutedA=Boolean(state.mutedA);rack.syncTap();rack.syncSource();await a.applyRouting();check();
    // A saved static graph starts settled, without the live rack's click ramps.
    staticValue(rack.gateA.gain,rack.mutedA?0:1);staticValue(rack.gateB.gain,rack.enabledB?1:0);staticValue(rack.mix.gain,1);staticValue(rack.output.gain,1);
    for(const [pan,value]of [[rack.pannerA.pan,state.panA??0],[rack.pannerB.pan,state.panB??0]]){if(!Number.isFinite(value)||Math.abs(value)>1)throw Error('Invalid lane pan');staticValue(pan,value);}
    for(const lane of lanes)staticValue(lane.transitionGain.gain,1);
    const input=context.createGain();input.channelCount=1;input.channelCountMode='explicit';
    const trim=state.sourceTrim?.file??-18;if(!Number.isFinite(trim)||trim < -48||trim>12)throw Error('Invalid DI input trim');input.gain.value=10**(trim/20);input.connect(a.input);
    return{input,output:rack.output,assertHealthy(){if(errors.length)throw Error(errors.join('; '));},destroy(){input.disconnect();rack.destroy();}};
  }catch(error){if(rack)rack.destroy();else for(const lane of lanes)lane.destroy();throw error;}
}
