const FULL_RIG_NAME=/\bfull[\s_-]*rig\b/i;
const normalizeGear=(value)=>typeof value==='string'?value.trim().toLowerCase().replace(/[\s_]+/g,'-'):'';
export function detectFullRig(model={}) {
  model=model||{};
  const metadata=model.rawMetadata||model.metadata||{};
  const toneGear=normalizeGear(model.provenance?.gear);
  const provenanceSource=model.provenance?.source||'TONE3000';
  if(toneGear==='amp-cab'||toneGear==='full-rig')return {fullRig:true,reason:`${provenanceSource} ${toneGear} metadata`};
  if(toneGear==='amp')return {fullRig:false,reason:`${provenanceSource} amp metadata`};
  const modelGear=normalizeGear(metadata.gear_type||metadata.gear);
  if(modelGear==='amp-cab'||modelGear==='full-rig')return {fullRig:true,reason:`${modelGear} metadata`};
  if(modelGear==='amp')return {fullRig:false,reason:'amp metadata'};
  for(const value of [metadata.name,model.name])if(typeof value==='string'&&FULL_RIG_NAME.test(value))return {fullRig:true,reason:`"full rig" detected in model name`};
  return {fullRig:false,reason:'no full-rig indication'};
}
export function cabinetRoutingDecision(mode,model) {
  if(mode==='on')return {bypass:false,text:'Cabinet ON: active — manual override'};
  if(mode==='bypass')return {bypass:true,text:'Cabinet BYPASS: bypassed — manual override'};
  const detected=detectFullRig(model);return {bypass:detected.fullRig,text:`Cabinet AUTO: ${detected.fullRig?'bypassed':'active'} — ${detected.reason}`};
}
