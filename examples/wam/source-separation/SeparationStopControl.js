/** Separation cancellation is independent of the audio transport's Stop button. */
export function separationStopState(busy,requested=false){
  return {disabled:!busy||requested,label:busy&&requested?'Arrêt en cours…':'Stopper la séparation'};
}
export function requestSeparationStop({busy,requested,runners,onRequest}){
  if(!busy||requested)return false;
  // Lock the UI before rejecting the worker promises, including synchronous mocks.
  onRequest();
  for(const runner of runners)runner?.cancel();
  return true;
}
