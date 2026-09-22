import addFunctionModule from '../../third_party/wam-examples/packages/sdk/src/addFunctionModule.js';
import WamNode from '../../third_party/wam-examples/packages/sdk/src/WamNode.js';
import getCabinetProcessor from './CabinetProcessor.js';
import {analyzeImpulseResponse} from './levelMatch.js';
export default class CabinetNode extends WamNode {
  static moduleLoads=new WeakMap();
  static async addModules(context,moduleId,wasmUrl){let modules=this.moduleLoads.get(context);if(!modules){modules=new Map();this.moduleLoads.set(context,modules);}if(!modules.has(moduleId))modules.set(moduleId,this.loadModules(context,moduleId,wasmUrl).catch(error=>{modules.delete(moduleId);throw error;}));return modules.get(moduleId);}
  static async loadModules(context,moduleId,wasmUrl){await super.addModules(context,moduleId);await addFunctionModule(context.audioWorklet,getCabinetProcessor,moduleId);const r=await fetch(wasmUrl);if(!r.ok)throw Error(`Cannot load Cabinet WASM: ${r.status}`);this.wasmModule=await WebAssembly.compile(await r.arrayBuffer());}
  constructor(module){super(module,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit',channelInterpretation:'discrete',processorOptions:{wasmModule:CabinetNode.wasmModule,useSab:false}});this._id=0;this._pending=new Map();this._ir=null;this._trimByIr={};this._gui=null;this.routingMode='auto';this._listeners=new Set();}
  _onMessage(message){const d=message.data;if(!d.cabinetResponse)return super._onMessage(message);const p=this._pending.get(d.requestId);if(!p)return;this._pending.delete(d.requestId);d.ok?p.resolve(d.content):p.reject(Error(d.error));}
  _request(cabinetRequest,payload={},transfer=[]){const requestId=++this._id;return new Promise((resolve,reject)=>{this._pending.set(requestId,{resolve,reject});this.port.postMessage({cabinetRequest,requestId,...payload},transfer);});}
  async loadImpulseResponse(samples,name='cabinet.wav',assetId=name,metadata={}){this.assetRevision=(this.assetRevision||0)+1;const analysis=analyzeImpulseResponse(samples);const copy=new Float32Array(samples);const trimDb=this._trimByIr[assetId]??0;const result=await this._request('load',{samples:copy.buffer,name,compensation:analysis.compensation,analysis},[copy.buffer]);this._ir={id:assetId,name,samples:Array.from(samples),analysis,metadata:structuredClone(metadata)};await this.setParameterValues({irTrim:{id:'irTrim',value:trimDb,normalized:false}});this._gui?.setIrStatus(name,result,analysis,trimDb);this._listeners.forEach(fn=>fn());return {...result,analysis,trimDb};}
  startDiagnostic(){return this._request('diagnostic/start');} stopDiagnostic(){return this._request('diagnostic/stop');} getCabinetStatus(){return this._request('status');}
  async getState(){const s=await super.getState();return structuredClone({parameterValues:s.parameterValues,ir:this._ir,trimByIr:this._trimByIr,routingMode:this.routingMode,stateVersion:2});}
  async setState(s){s=structuredClone(s);this.assetRevision=(this.assetRevision||0)+1;this.setRoutingMode(s.routingMode||'auto');this._trimByIr=s.trimByIr||{};if(s.ir?.samples)await this.loadImpulseResponse(Float32Array.from(s.ir.samples),s.ir.name,s.ir.id||s.ir.name,s.ir.metadata||{});await super.setState({parameterValues:s.parameterValues||{}});this._gui?.syncParameters(await super.getParameterValues(false));}
  async setIrTrimDb(value){if(!this._ir)return 0;const trim=Math.max(-12,Math.min(12,Number(value)||0));this._trimByIr[this._ir.id]=trim;await this.setParameterValues({irTrim:{id:'irTrim',value:trim,normalized:false}});return trim;}
  async setParameterValues(values){await super.setParameterValues(values);this._gui?.syncParameters(await super.getParameterValues(false));}
  addChangeListener(fn){this._listeners.add(fn);return ()=>this._listeners.delete(fn);}
  getIrSnapshot(){return this._ir?structuredClone({id:this._ir.id,name:this._ir.name,metadata:this._ir.metadata}):null;}
  setRoutingMode(mode){if(!['auto','on','bypass'].includes(mode))throw Error('Invalid routing mode');this.routingMode=mode;this.dispatchEvent(new Event('routing-mode'));}
  destroy(){this.toneSession?.destroy();this._gui?.destroy?.();this._listeners.clear();super.destroy();}
  set gui(v){this._gui=v;} get gui(){return this._gui;}
}
