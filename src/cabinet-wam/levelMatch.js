export const analyzeImpulseResponse = (samples, {minimumDb=-24,maximumDb=24,silenceEnergy=1e-12}={}) => {
  let energy=0;
  for(let i=0;i<samples.length;++i){const sample=samples[i];if(!Number.isFinite(sample))return {energy:NaN,l2Norm:NaN,rawCompensationDb:0,compensationDb:0,compensation:1,valid:false,reason:'non-finite samples'};energy+=sample*sample;}
  if(!Number.isFinite(energy)||energy<=silenceEnergy)return {energy,l2Norm:Math.sqrt(Math.max(0,energy)),rawCompensationDb:0,compensationDb:0,compensation:1,valid:false,reason:'silent or near-silent IR'};
  const l2Norm=Math.sqrt(energy),rawCompensationDb=-20*Math.log10(l2Norm),compensationDb=Math.max(minimumDb,Math.min(maximumDb,rawCompensationDb));
  return {energy,l2Norm,rawCompensationDb,compensationDb,compensation:10**(compensationDb/20),valid:true,clamped:compensationDb!==rawCompensationDb};
};
