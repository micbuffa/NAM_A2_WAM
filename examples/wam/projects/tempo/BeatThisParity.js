// Numerical qualification, not musical accuracy. Never silently accept bad GPU logits.
export function compareLogits(reference,candidate,{tolerance=.002}={}) {
  let maxAbs=0;
  for(const key of ['beat','downbeat']){
    const a=reference[key],b=candidate[key];
    if(!a||!b||a.length!==b.length||!a.length)return {passed:false,maxAbs:null,reason:'shape'};
    for(let i=0;i<a.length;i++){
      if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))return {passed:false,maxAbs:null,reason:'non-finite'};
      maxAbs=Math.max(maxAbs,Math.abs(a[i]-b[i]));
    }
  }
  return {passed:maxAbs<=tolerance,maxAbs,tolerance};
}
export function sameEvents(reference,candidate) {
  return ['beats','downbeats'].every(key=>reference[key].length===candidate[key].length&&reference[key].every((time,i)=>time===candidate[key][i]));
}
