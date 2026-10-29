// Physically remove microphone -> FX and app -> speakers routes, not merely
// their gain values. Probes use a separate direct output; presets stay intact.
export function guardCalibrationAudio({context,source,outputs,pause=()=>{},disableInput}) {
  const releaseMonitoring=source.suspendMonitoring();
  for (const output of outputs) output.disconnect(context.destination);
  try { pause(); }
  catch(error) { releaseMonitoring();for(const output of outputs)output.connect(context.destination);throw error; }
  let done=false;
  return async()=>{
    if(done)return;done=true;
    // Never reconnect a microphone-monitor loop on close, success or failure.
    await disableInput();
    releaseMonitoring();
    for (const output of outputs) output.connect(context.destination);
  };
}
