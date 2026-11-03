import {createDialog, button, actionsRow} from './account/dialogs.js';
import {InputGainCalibration, GAIN_ANALYSIS_SECONDS} from './InputGainCalibration.js';

export function inputGainDialog({context, source, channel, apply, allowed = () => true}) {
  if (!allowed()) throw Error('Finish recording or latency calibration before adjusting input gain.');
  if (source.mode !== 'live') throw Error('Enable live input before adjusting input gain.');
  const {dialog, body} = createDialog({title: 'Automatic input gain'});
  const instructions = document.createElement('p');
  instructions.textContent = 'Turn your guitar volume all the way up. Press Start, then strum hard for 5 seconds. The input gain will be adjusted automatically, leaving 6 dB of headroom.';
  const status = document.createElement('p');status.setAttribute('role', 'status');status.setAttribute('aria-live', 'polite');
  const progress = document.createElement('progress');progress.max = GAIN_ANALYSIS_SECONDS;progress.value = 0;progress.hidden = true;progress.setAttribute('aria-label', 'Input gain analysis');
  const start = button('Start · 5 seconds', {primary: true}), close = button('Cancel');
  const analysis = new InputGainCalibration({context, source, channel, progress: elapsed => {
    progress.value = elapsed; status.textContent = `Strum hard · ${Math.ceil(GAIN_ANALYSIS_SECONDS - elapsed)} s remaining`;
  }});
  start.onclick = async () => {
    start.disabled = true;
    try {
      if (!allowed()) throw Error('Finish recording or latency calibration first.');
      await context.resume();
      if (!dialog.open) return;
      progress.hidden = false;
      const result = await analysis.start();
      if (!dialog.open) return;
      if (!allowed()) throw Error('Recording started. Gain unchanged; try again after recording.');
      apply(result.db);
      status.textContent = `Input gain set to ${result.db.toFixed(1)} dB.${result.limited ? ' Software gain reached its limit; increase the interface gain if needed.' : ' Peak target: −6 dBFS.'}`;
      close.textContent = 'Close'; start.hidden = true;
    } catch (error) { status.textContent = error.message; }
    finally { start.disabled = false; }
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => analysis.cancel(), {once: true});
  body.append(instructions, progress, status, actionsRow(close, start));dialog.showModal();
}
