export const PLUGIN_CATEGORIES=Object.freeze(['tuner','dynamics','drive','filter-wah','modulation','delay','reverb','stereo-utility','amplifier','cabinet','other']);
const CATEGORY_ALIASES=new Map([
  ['tuner','tuner'],['noisegate','dynamics'],['noise gate','dynamics'],['gate','dynamics'],['compressor','dynamics'],['limiter','dynamics'],
  ['overdrive','drive'],['distortion','drive'],['boost','drive'],['drive','drive'],['wahwah','filter-wah'],['wah','filter-wah'],['filter','filter-wah'],
  ['chorus','modulation'],['phaser','modulation'],['flanger','modulation'],['modulation','modulation'],['delay','delay'],['echo','delay'],
  ['reverb','reverb'],['stereo enhancer','stereo-utility'],['stereo','stereo-utility'],['utility','stereo-utility'],
  ['amplifier','amplifier'],['amp','amplifier'],['cabinet','cabinet'],['speaker','cabinet'],['ir','cabinet']
]);
const GENERIC_TAGS=new Set(['faust','effect','audio','guitar']);
const clean=(value)=>String(value??'').trim();
const normalizedTag=(value)=>clean(value).toLocaleLowerCase('en-US').replace(/[_]+/gu,' ').replace(/\s+/gu,' ');
const isLocalHostname=(hostname)=>hostname==='localhost'||hostname==='127.0.0.1'||hostname==='[::1]'||hostname==='::1';
const stableHash=(text)=>{let hash=2166136261;for(const character of text){hash^=character.codePointAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);};

export function isAllowedPluginUrl(value){
  const url=value instanceof URL?value:new URL(value);
  return url.protocol==='https:'||(url.protocol==='http:'&&isLocalHostname(url.hostname));
}

export function normalizeCategory(override,descriptor={},tags=[]){
  const candidates=[override,descriptor.category,...tags];
  const text=`${descriptor.name||''} ${descriptor.description||''}`.toLocaleLowerCase('en-US');
  for(const candidate of candidates){
    const key=normalizedTag(candidate);
    if(PLUGIN_CATEGORIES.includes(key))return key;
    if(CATEGORY_ALIASES.has(key))return CATEGORY_ALIASES.get(key);
  }
  for(const [needle,category] of CATEGORY_ALIASES)if(!GENERIC_TAGS.has(needle)&&text.includes(needle))return category;
  return 'other';
}

export function normalizeCatalogueEntry(entry,catalogueUrl,index=0){
  const source=typeof entry==='string'?{uri:entry}:entry;
  if(!source||typeof source!=='object'||!clean(source.uri))throw new TypeError(`Plugin entry ${index+1} has no URI`);
  const entryUrl=new URL(source.uri,catalogueUrl);
  if(!isAllowedPluginUrl(entryUrl))throw new TypeError(`Plugin entry ${index+1} uses an unsafe URL: ${entryUrl.href}`);
  const descriptorUrl=source.descriptor?new URL(source.descriptor,catalogueUrl):new URL('descriptor.json',entryUrl);
  if(!isAllowedPluginUrl(descriptorUrl))throw new TypeError(`Plugin descriptor ${index+1} uses an unsafe URL: ${descriptorUrl.href}`);
  return {...source,entryUrl:entryUrl.href,descriptorUrl:descriptorUrl.href,origin:entryUrl.origin===new URL(catalogueUrl).origin?'bundled':'remote'};
}

export function normalizeDescriptor(entry,descriptor={}){
  const tags=[...(Array.isArray(descriptor.keywords)?descriptor.keywords:[]),...(Array.isArray(entry.tags)?entry.tags:[])].map(normalizedTag).filter(Boolean);
  const uniqueTags=[...new Set(tags)];
  const name=clean(entry.name||descriptor.name)||new URL(entry.entryUrl).pathname.split('/').filter(Boolean).at(-2)||'Unnamed plugin';
  const thumbnailValue=entry.thumbnail||descriptor.thumbnail;
  const thumbnailUrl=thumbnailValue?new URL(thumbnailValue,entry.descriptorUrl).href:null;
  const category=normalizeCategory(entry.category,descriptor,uniqueTags);
  const role=normalizedTag(entry.role||descriptor.role||(category==='tuner'?'tuner':''))||null;
  return {
    id:clean(entry.id||descriptor.identifier)||`wam-${stableHash(entry.entryUrl)}`,
    entryUrl:entry.entryUrl,descriptorUrl:entry.descriptorUrl,identifier:clean(descriptor.identifier)||null,
    name,vendor:clean(entry.vendor||descriptor.vendor)||'Unknown vendor',description:clean(descriptor.description),version:clean(descriptor.version)||null,
    apiVersion:clean(descriptor.apiVersion)||null,category,tags:uniqueTags,thumbnailUrl,role,origin:entry.origin,
    isInstrument:Boolean(descriptor.isInstrument),hasAudioInput:descriptor.hasAudioInput!==false,hasAudioOutput:descriptor.hasAudioOutput!==false,
    hasMidiInput:Boolean(descriptor.hasMidiInput),hasMidiOutput:Boolean(descriptor.hasMidiOutput),descriptor:{...descriptor},catalogue:{...entry},
    status:'descriptor-valid',stages:{catalogued:true,descriptorValid:true,importable:false,instantiable:false,guiValid:false,audioValid:false,stateValid:false},diagnostics:[]
  };
}

export function fallbackThumbnail(record){
  const hue=parseInt(stableHash(record.id),36)%360;
  const initials=record.name.replace(/[^\p{L}\p{N}\s]/gu,'').split(/\s+/u).slice(0,2).map(word=>word[0]||'').join('').toUpperCase()||'FX';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><defs><linearGradient id="g"><stop stop-color="hsl(${hue} 58% 32%)"/><stop offset="1" stop-color="#11121a"/></linearGradient></defs><rect width="100%" height="100%" rx="24" fill="url(#g)"/><circle cx="160" cy="94" r="48" fill="none" stroke="white" stroke-opacity=".7" stroke-width="7"/><text x="160" y="112" fill="white" text-anchor="middle" font-family="system-ui" font-size="42" font-weight="800">${initials}</text><text x="160" y="185" fill="white" fill-opacity=".78" text-anchor="middle" font-family="system-ui" font-size="17">WAM</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export class WamPluginRegistry{
  constructor({fetchImpl=globalThis.fetch?.bind(globalThis),importModule=(url)=>import(url)}={}){this.fetchImpl=fetchImpl;this.importModule=importModule;this.records=[];this.diagnostics=[];this.catalogueUrl='';}
  async load(catalogueUrl){
    this.catalogueUrl=new URL(catalogueUrl,globalThis.location?.href||'http://localhost/').href;this.records=[];this.diagnostics=[];
    const response=await this.fetchImpl(this.catalogueUrl,{cache:'no-store'});if(!response.ok)throw new Error(`Plugin catalogue fetch failed (${response.status}): ${this.catalogueUrl}`);
    const catalogue=await response.json();if(catalogue.version!==1||!Array.isArray(catalogue.plugins))throw new TypeError('Unsupported or malformed plugin catalogue');
    const seen=new Set();
    for(let index=0;index<catalogue.plugins.length;index++){
      let entry;
      try{entry=normalizeCatalogueEntry(catalogue.plugins[index],this.catalogueUrl,index);if(seen.has(entry.entryUrl)){this.diagnostics.push({stage:'catalogue',level:'warning',message:`Duplicate plugin ignored: ${entry.entryUrl}`});continue;}seen.add(entry.entryUrl);}
      catch(error){this.diagnostics.push({stage:'catalogue',level:'error',message:error.message,index});continue;}
      try{
        const descriptorResponse=await this.fetchImpl(entry.descriptorUrl,{cache:'no-store'});if(!descriptorResponse.ok)throw new Error(`Descriptor fetch failed (${descriptorResponse.status})`);
        const descriptor=await descriptorResponse.json();this.records.push(normalizeDescriptor(entry,descriptor));
      }catch(error){
        const record=normalizeDescriptor(entry,{});record.status='descriptor-error';record.stages.descriptorValid=false;record.diagnostics.push({stage:'descriptor',level:'error',message:`${error.message}: ${entry.descriptorUrl}`});this.records.push(record);
      }
    }
    return this.records;
  }
  find(id){return this.records.find(record=>record.id===id);}
  async import(record){
    try{const module=await this.importModule(record.entryUrl);if(typeof module?.default!=='function')throw new TypeError('Module has no default WAM class export');record.stages.importable=true;record.status='importable';record.module=module;return module;}
    catch(error){record.status='import-error';record.diagnostics.push({stage:'import',level:'error',message:`${error.message}: ${record.entryUrl}`});throw error;}
  }
  async instantiate(record,{groupId,audioContext,state}={}){
    const module=record.module||await this.import(record);const Plugin=module.default;
    try{const plugin=await Plugin.createInstance(groupId,audioContext,state?{initialState:state}:{});if(!plugin?.audioNode)throw new Error('WAM instance did not expose audioNode');record.stages.instantiable=true;record.status='instantiable';return plugin;}
    catch(error){record.status='instantiate-error';record.diagnostics.push({stage:'instantiate',level:'error',message:error.message});throw error;}
  }
  async inspectInstance(record,plugin){
    const result={parameters:null,state:null,gui:null};
    try{result.parameters=await plugin.audioNode.getParameterInfo?.()||{};}catch(error){record.diagnostics.push({stage:'parameters',level:'warning',message:error.message});}
    try{result.state=await plugin.audioNode.getState?.();if(result.state!==undefined){await plugin.audioNode.setState?.(result.state);record.stages.stateValid=true;}}catch(error){record.diagnostics.push({stage:'state',level:'warning',message:error.message});}
    try{result.gui=await plugin.createGui?.();record.stages.guiValid=Boolean(result.gui);}catch(error){record.diagnostics.push({stage:'gui',level:'warning',message:error.message});}
    if(record.stages.guiValid&&record.stages.stateValid)record.status='state-valid';return result;
  }
  markAudioValidation(record,{inputPeak=0,outputPeak=0}={}){
    if(!Number.isFinite(inputPeak)||!Number.isFinite(outputPeak))throw new TypeError('Audio validation produced a non-finite level');
    if(inputPeak<1e-6)throw new Error('Audio validation source is silent');
    if(outputPeak<1e-7)throw new Error('Plugin produced silence for the deterministic test signal');
    record.stages.audioValid=true;record.status=record.stages.guiValid&&record.stages.stateValid?'validated':'audio-valid';return {inputPeak,outputPeak};
  }
}

export function destroyPluginInstance(plugin,gui){try{gui?.remove?.();}catch{}try{plugin?.audioNode?.disconnect?.();}catch{}try{plugin?.audioNode?.destroy?.();}catch{}try{plugin?.destroy?.();}catch{}}
