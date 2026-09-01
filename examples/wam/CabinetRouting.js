const FULL_RIG_NAME=/\bfull[\s_-]*rig\b/i;
export function detectFullRig(model={}) {
  model=model||{};
  const metadata=model.rawMetadata||model.metadata||{};
  if(typeof metadata.gear_type==='string'&&metadata.gear_type.trim().toLowerCase()==='full-rig')return {fullRig:true,reason:'full-rig metadata'};
  for(const value of [metadata.name,model.name])if(typeof value==='string'&&FULL_RIG_NAME.test(value))return {fullRig:true,reason:`"full rig" detected in model name`};
  return {fullRig:false,reason:'no full-rig indication'};
}
export function cabinetRoutingDecision(mode,model) {
  if(mode==='on')return {bypass:false,text:'Cabinet ON: active — manual override'};
  if(mode==='bypass')return {bypass:true,text:'Cabinet BYPASS: bypassed — manual override'};
  const detected=detectFullRig(model);return {bypass:detected.fullRig,text:`Cabinet AUTO: ${detected.fullRig?'bypassed':'active'} — ${detected.reason}`};
}
