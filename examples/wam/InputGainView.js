import {createDialog, button, actionsRow} from './account/dialogs.js';
import {InputGainCalibration, GAIN_ANALYSIS_SECONDS} from './InputGainCalibration.js';

export function inputGainDialog({context, source, getChannel, getGain, apply, allowed = () => true}) {
  if (!allowed()) throw Error('Finish recording or latency calibration before adjusting input gain.');
  if (source.mode !== 'live') throw Error('Enable live input before adjusting input gain.');
  const {dialog, body} = createDialog({title: 'Automatic input gain'});
  const instructions = document.createElement('p');
  instructions.textContent = 'Turn your guitar volume all the way up. Press Start, then strum hard for 5 seconds. We’ll suggest a software gain that leaves 6 dB of headroom.';
  const status = document.createElement('p');status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');
  const progress = document.createElement('progress');progress.max = GAIN_ANALYSIS_SECONDS;progress.value = 0;progress.hidden = true;progress.setAttribute('aria-label', 'Input gain analysis');
  const start = button('Start · 5 seconds', {primary: true}), close = button('Cancel');
  const keep = button('OK, keep this setting', {primary: true});
  keep.hidden = true;
  let analysis, proposal;
  const showRetry = () => {
    start.textContent = 'Try again';
    start.hidden = false;
    keep.hidden = true;
  };
  start.onclick = async () => {
    start.disabled = true;
    proposal = null;
    keep.hidden = true;
    try {
      if (!allowed()) throw Error('Finish recording or latency calibration first.');
      await context.resume();
      if (!dialog.open) return;
      const input = source.liveInput, channel = getChannel();
      if (!input || !Number.isInteger(channel)) throw Error('Select an available live input channel first.');
      analysis = new InputGainCalibration({context, source, channel, progress: elapsed => {
        progress.value = elapsed;
        status.textContent = `Strum hard · ${Math.ceil(GAIN_ANALYSIS_SECONDS - elapsed)} s remaining`;
      }});
      progress.hidden = false;
      const result = await analysis.start();
      if (!dialog.open) return;
      if (!allowed()) throw Error('Recording started. Gain unchanged; try again after recording.');
      proposal = {input, channel, db: result.db};
      const limit = result.limited ? ' Software boost reached its limit.' : '';
      status.textContent = `Measured input peak: ${result.peakDb.toFixed(1)} dBFS. Suggested gain: ${result.db.toFixed(1)} dB (current: ${getGain().toFixed(1)} dB). Estimated peak: ${(result.peakDb + result.db).toFixed(1)} dBFS.${limit}`;
      showRetry();
      keep.hidden = false;
      keep.focus();
    } catch (error) {
      if (dialog.open) {
        progress.hidden = true;
        status.textContent = error.message;
        showRetry();
      }
    }
    finally { start.disabled = false; }
  };
  keep.onclick = () => {
    if (!proposal) return;
    if (!allowed() || source.mode !== 'live' || source.liveInput !== proposal.input || getChannel() !== proposal.channel) {
      proposal = null;
      progress.hidden = true;
      status.textContent = 'Input changed or calibration is unavailable. Try again when the input is ready.';
      showRetry();
      start.focus();
      return;
    }
    apply(proposal.db);
    dialog.close();
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => analysis?.cancel(), {once: true});
  body.append(instructions, progress, status, actionsRow(close, start, keep));
  dialog.showModal();
}
