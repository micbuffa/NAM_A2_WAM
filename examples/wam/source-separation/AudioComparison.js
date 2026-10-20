export function compareAudio(reference,candidate) {
  if(!reference.length||reference.length!==candidate.length)throw Error('Nombre de canaux différent.');
  let squaredError=0,squaredReference=0,maxAbsError=0,count=0;
  const channels=reference.map((ref,index)=>{
    const out=candidate[index];
    if(!(ref instanceof Float32Array)||!(out instanceof Float32Array)||!ref.length||ref.length!==out.length)throw Error('Canaux désalignés.');
    let energy=0,error=0,peak=0;
    for(let i=0;i<ref.length;i++) {
      if(!Number.isFinite(ref[i])||!Number.isFinite(out[i]))throw Error('Audio non fini.');
      const delta=ref[i]-out[i];energy+=ref[i]*ref[i];error+=delta*delta;peak=Math.max(peak,Math.abs(delta));
    }
    squaredError+=error;squaredReference+=energy;count+=ref.length;maxAbsError=Math.max(maxAbsError,peak);
    return {rmsError:Math.sqrt(error/ref.length),maxAbsError:peak,referenceRms:Math.sqrt(energy/ref.length)};
  });
  const rmsError=Math.sqrt(squaredError/count),relativeRmsError=Math.sqrt(squaredError/Math.max(squaredReference,1e-30));
  return {channels,rmsError,relativeRmsError,maxAbsError,withinTolerance:maxAbsError<=.005&&(relativeRmsError<=.01||rmsError<=1e-5)};
}

// Without isolated reference stems this measures remix consistency only.
// It deliberately does not invent a source-separation quality score.
export function analyzeSeparation(mix,stems,roles) {
  if(mix.length!==2||!roles.length||stems.length!==roles.length*2)throw Error('Nombre de pistes invalide.');
  const frames=mix[0]?.length;
  const remix=[new Float32Array(frames),new Float32Array(frames)];
  const statistics=roles.map((role,index)=>{
    let energy=0,peak=0,stereoDifference=0;
    for(let c=0;c<2;c++){
      const channel=stems[index*2+c];
      if(!(channel instanceof Float32Array)||channel.length!==frames)throw Error('Pistes désalignées.');
      for(let i=0;i<frames;i++){
        const value=channel[i];if(!Number.isFinite(value))throw Error('Audio non fini.');
        energy+=value*value;peak=Math.max(peak,Math.abs(value));remix[c][i]+=value;
      }
    }
    for(let i=0;i<frames;i++)stereoDifference+=(stems[index*2][i]-stems[index*2+1][i])**2;
    return {role,rms:Math.sqrt(energy/(frames*2)),peak,stereoDifferenceRms:Math.sqrt(stereoDifference/frames)};
  });
  const {rmsError,relativeRmsError,maxAbsError}=compareAudio(mix,remix);
  return {stems:statistics,remixResidual:{rmsError,relativeRmsError,maxAbsError},hasIsolatedReferences:false};
}
