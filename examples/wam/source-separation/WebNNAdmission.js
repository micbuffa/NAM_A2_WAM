import {webnnAudioParity} from './WebNNParity.js';

// A cumulative dispatch count is insufficient: this block must have executed
// WebNN, and the quietest roles must pass the same predeclared audio gate.
export function admitWebNNBlock(reference,candidate,dispatchesBefore,dispatchesAfter) {
  if(!Number.isSafeInteger(dispatchesBefore)||!Number.isSafeInteger(dispatchesAfter)||dispatchesBefore<0||dispatchesAfter<=dispatchesBefore) {
    throw Error('WebNN admission failed: no WebNN dispatch observed for this block');
  }
  const parity=webnnAudioParity(reference,candidate);
  if(!parity.passed)throw Object.assign(Error('WebNN admission failed: strict per-role audio parity failed'),{parity});
  return parity;
}

// Observe loss immediately (including while waiting for the WASM reference),
// without an unhandled rejection. The caller owns and destroys the context.
export function contextGuard(context) {
  const lost=context?.lost?.then(info=>{throw Error(`WebNN context lost: ${info?.message||'unknown'}`);});
  lost?.catch(()=>{});
  return promise=>lost?Promise.race([promise,lost]):promise;
}
