import {backendLabel, isWebNN, studioBackendOptions} from '../source-separation/StudioWebNN.js';
import {StudioSeparation, separationSources} from './StudioSeparation.js';

// Adapts the transient separation deck to the existing Studio timeline. Progress
// never rebuilds track rows, scans PCM, or drives the audio clock.
export class StudioSeparationView {
  constructor(workspace) {
    this.workspace = workspace;
    this.$ = workspace.$;
    this.controller = new StudioSeparation({context: workspace.player.context, player: workspace.player});
    const c = this.controller;
    this.$('studioSavedResult').onchange = async event => {
      if (workspace.saving || workspace.history?.busy) return;
      const id = Number(event.target.value), project = workspace.project, epoch = workspace.accountLoadEpoch;
      if (c.result && !await this.confirmReplace()) return this.render();
      if (workspace.dirty && !await workspace.confirmSavedMixDiscard()) return this.render();
      if (workspace.project !== project || workspace.accountLoadEpoch !== epoch || workspace.saving) return;
      workspace.saving = true; workspace.render();
      try {
        if (workspace.owned) {
          const full = await workspace.api.activateSeparation(project.id, id);
          if (workspace.project !== project || workspace.accountLoadEpoch !== epoch) return;
          c.stop({reset:true}); workspace.setProject(full, {historyLabel: 'Change separation'}); workspace.replaceSummary(full);
        } else {
          c.stop({reset:true}); c.selectSaved(id);
        }
      } catch (error) { workspace.report(`Separation not opened: ${error.message}`, true); }
      finally {
        if (workspace.project?.id === project?.id && workspace.accountLoadEpoch === epoch) { workspace.saving = false; workspace.render(); }
      }
    };
    this.$('studioSeparate').onclick = () => this.chooseModel();
    this.$('studioStop').onclick = () => c.stop();
    this.$('studioOriginal').onclick = () => c.show('original');
    this.$('studioInstruments').onclick = () => c.show('stems');
    this.$('studioModel').onchange = this.$('studioBackend').onchange = async () => {
      const model = this.$('studioModel').value, backend = this.$('studioBackend').value;
      if ((c.busy || c.result) && !await this.confirmReplace()) return this.render();
      if (!workspace.saving) {
        try { c.configure(model, backend); }
        catch(error) { workspace.report(error.message,true);this.render(); }
      }
    };
    this.$('studioCheckCache').onclick = async () => {
      if (!c.model || c.busy) return;
      this.$('studioCacheStatus').textContent = 'Checking model cache…';
      const modelId = c.modelId;
      try {
        const status = await c.manager.getStatus(c.model);
        if (c.modelId === modelId) this.$('studioCacheStatus').textContent = status.state === 'installed' ? 'Downloaded and SHA-256 verified.' : 'Not downloaded, or invalid. Separate will download and verify it.';
      } catch (error) { this.$('studioCacheStatus').textContent = error.message; }
    };
    this.$('studioRemoveCache').onclick = async () => {
      if (!c.model || c.busy) return;
      try { await c.manager.remove(c.model); this.$('studioCacheStatus').textContent = 'Model cache cleared. Your audio is unchanged.'; }
      catch (error) { this.$('studioCacheStatus').textContent = error.message; }
    };
    c.addEventListener('change', () => {
      this.render();
      const display = c.viewTracks;
      if (display !== this.display) {
        this.display = display;
        workspace.selectedId = display?.[0]?.id ?? workspace.project?.tracks[0]?.id ?? null;
        workspace.renderHeader();
        workspace.renderTracks();
        workspace.renderInspector();
        workspace.syncPlayer();
        this.flushWaves();
      }
      workspace.renderHeader();
      workspace.renderLength();
      workspace.renderTransport();
    });
    workspace.player.addEventListener('statechange', () => this.render());
    c.addEventListener('audio', () => {
      if (!this.waveTimer) this.waveTimer = setTimeout(() => { this.waveTimer = null; this.flushWaves(); }, 250);
    });
    this.ready = c.init().catch(error => c.setStatus(`Separation unavailable: ${error.message}`));
  }
  async chooseModel({sourceId = null, allowUnseparated = false} = {}) {
    if (this.workspace?.recording?.busy || this.workspace?.recording?.pending.size) { this.workspace.report('Save the new DI take before separating instruments.', true); return; }
    const w = this.workspace, c = this.controller;
    await this.ready;
    if (w.saving || !w.owned || !c.model || this.modelDialog) return;
    const projectId = w.project?.id, accountEpoch = w.accountLoadEpoch;
    if (sourceId !== null) this.$('studioSource').value = String(sourceId);
    const {createDialog, button} = await import('../account/dialogs.js');
    const {dialog, body} = createDialog({title: allowUnseparated ? 'Keep audio or separate instruments' : 'Separate instruments'});
    this.modelDialog = dialog;
    const durationLabel = document.createElement('label');
    durationLabel.textContent = 'Duration to separate';
    const duration = document.createElement('select');
    duration.id = 'studioExcerpt';
    for (const [value, text] of [[0, 'Entire song'], [5, 'First 5 seconds'], [10, 'First 10 seconds'], [30, 'First 30 seconds'], [60, 'First 60 seconds']]) {
      const option = document.createElement('option');
      option.value = String(value); option.textContent = text;
      duration.append(option);
    }
    duration.value = '0';
    durationLabel.append(duration);
    const engineLabel = document.createElement('label'), engine = document.createElement('select');
    engineLabel.textContent = 'Execution engine';engine.id = 'studioDialogBackend';
    for(const {value,label,disabled} of studioBackendOptions({webgpu:c.gpu,webnn:c.webnn})){
      const option=document.createElement('option');Object.assign(option,{value,textContent:label,disabled});engine.append(option);
    }
    engine.value=c.backend;engineLabel.append(engine);
    const engineHelp=document.createElement('p');engineHelp.className='host-help';engineHelp.setAttribute('role','status');
    const choices = document.createElement('div');
    choices.className = 'studio-model-choices';
    for (const [id, label] of [['htdemucs_4s_onnx', '4 tracks · Fast'], ['bs_roformer_sw_6s', '6 tracks · Guitar & piano']]) {
      const choice = button(label, {primary: id === c.modelId});
      choice.onclick = async () => {
        const seconds = Number(duration.value), requestedBackend = engine.value;
        dialog.close();
        if (w.project?.id !== projectId || w.accountLoadEpoch !== accountEpoch || w.saving || !w.owned) return;
        if ((c.busy || c.result) && !await this.confirmReplace()) return;
        const backend = requestedBackend;
        if (w.project?.id !== projectId || w.accountLoadEpoch !== accountEpoch || w.saving || !w.owned) return;
        c.configure(id, backend);
        const track = separationSources(w.project?.tracks ?? []).find(track => String(track.id) === this.$('studioSource').value);
        if (track) void c.run({track, projectId, seconds});
      };
      choice.dataset.modelId=id;choices.append(choice);
    }
    const updateEngine=()=>{
      for(const choice of choices.children)choice.disabled=isWebNN(engine.value)&&choice.dataset.modelId!=='htdemucs_4s_onnx';
      engineHelp.textContent=!c.webnn?'WebNN is not exposed by this browser. Use a WebNN-enabled build to enable CPU / GPU / NPU choices.':isWebNN(engine.value)?'WebNN is experimental for 4 tracks only. Each block is checked against WASM before playback; hardware device is not confirmed.':'Choose WebNN to test the experimental 4-track backend, or WebGPU / WASM for 4 or 6 tracks.';
    };
    engine.onchange=updateEngine;updateEngine();
    body.append(durationLabel,engineLabel,engineHelp,choices);
    if (allowUnseparated) {
      const keep = button('Keep as one track');
      keep.onclick = () => dialog.close();
      body.append(keep);
    }
    dialog.addEventListener('close', () => { this.modelDialog = null; }, {once: true});
    dialog.showModal();
  }
  async finishStaged(id) {
    const w = this.workspace, project = w.project, epoch = w.accountLoadEpoch;
    if (w.saving || !await w.confirmSavedMixDiscard() || !await w.confirmPreviewDiscard()) return;
    if (w.project !== project || w.accountLoadEpoch !== epoch) return;
    w.saving = true; w.render();
    try {
      const full = await w.api.publishSeparation(project.id,id);
      if (w.project !== project || w.accountLoadEpoch !== epoch) return;
      this.controller.stop({reset:true}); w.setProject(full, {historyLabel: 'Separate instruments'}); w.replaceSummary(full);
    } catch (error) { if (w.accountLoadEpoch === epoch) w.report(`Save not finished: ${error.message}`,true); }
    finally { if (w.project?.id === project.id && w.accountLoadEpoch === epoch) { w.saving = false; w.render(); } }
  }
  async discardStaged(id) {
    const w = this.workspace;
    if (w.saving) return;
    const {confirmDialog} = await import('../account/dialogs.js');
    if (!await confirmDialog({title:'Discard unfinished upload?',message:'Only the unfinished upload will be removed. Published instruments and the original remain.',confirmLabel:'Discard upload'})) return;
    try {
      await w.api.discardSeparation(w.project.id,id);
      w.project.separations = w.project.separations.filter(batch => batch.id !== id);
      if (this.controller.result?.stagingId === id) { delete this.controller.result.saveToken; delete this.controller.result.stagingId; }
      this.render();
    } catch(error) { w.report(`Upload not removed: ${error.message}`,true); }
  }
  async confirmReplace() {
    const {confirmDialog} = await import('../account/dialogs.js');
    return confirmDialog({title: 'Start a new separation?', confirmLabel: 'Replace preview',
      message: 'This stops the current calculation and replaces its temporary instrument preview. Your original audio and personal parts stay in the project. The preview is not saved to your account yet.'});
  }
  flushWaves() {
    const c = this.controller, result = c.result;
    if (!result || !result.engine.availableFrames || c.mode !== 'stems') return;
    const partial = result.engine.complete && result.engine.partial;
    const fraction = partial ? result.engine.availableFrames / result.totalFrames : 1;
    for (const track of result.tracks) this.workspace.timeline.setWave(track.id, {
      peaks: fraction < 1 ? track.peaks.subarray(0, Math.max(1, Math.ceil(track.peaks.length * fraction))) : track.peaks,
      duration: (partial ? result.engine.availableFrames : result.totalFrames) / 44100,
    });
  }
  render() {
    const w = this.workspace, c = this.controller, model = c.model;
    this.$('studioSeparation').hidden = !w.project;
    const batches = (w.project?.separations ?? []).filter(batch => batch.state === 'ready');
    const batchSignature = JSON.stringify(w.project?.separations ?? []);
    if (batchSignature !== this.batchSignature) {
      this.batchSignature = batchSignature;
      this.$('studioSavedResult').replaceChildren(...(batches.length ? batches.map(batch => new Option(
        `${w.project.tracks.find(track=>track.id===batch.sourceTrackId)?.name ?? 'Audio'} · ${batch.manifest.modelId === 'htdemucs_4s_onnx' ? 'Demucs 4' : 'SW 6'} · ${new Date(batch.createdAt).toLocaleString()}${batch.manifest.partial ? ' · partial' : ''}`, String(batch.id))) : [new Option('No saved separation', '')]));
      this.$('studioUnfinished').replaceChildren();
      if (w.owned) for (const batch of w.project.separations.filter(batch => batch.state === 'uploading')) {
        const row = document.createElement('p');
        row.textContent = `Unfinished save · ${batch.uploadedRoles.length}/${batch.manifest.roles.length} instruments. `;
        if (batch.uploadedRoles.length === batch.manifest.roles.length) {
          const finish = document.createElement('button'); finish.textContent = 'Finish saving';
          finish.onclick = () => this.finishStaged(batch.id); row.append(finish);
        }
        const discard = document.createElement('button'); discard.textContent = 'Discard unfinished upload';
        discard.onclick = () => this.discardStaged(batch.id); row.append(discard);
        this.$('studioUnfinished').append(row);
      }
    }
    if (c.activeSavedId) this.$('studioSavedResult').value = String(c.activeSavedId);
    this.$('studioSavedResult').closest('label').hidden = !w.owned || batches.length < 2;
    this.$('studioSavedResult').disabled = w.saving || c.busy || !batches.length;
    this.$('studioUnfinished').inert = Boolean(w.saving || c.busy);
    this.$('projectTracks').inert = Boolean(w.saving);
    this.$('studioModel').disabled = this.$('studioBackend').disabled = Boolean(w.saving);

    const sources = separationSources(w.project?.tracks ?? []), source = this.$('studioSource');
    const signature = sources.map(track => `${track.id}:${track.name}`).join('|');
    if (signature !== this.sourceSignature) {
      this.sourceSignature = signature;
      const selected = source.value;
      source.replaceChildren(...(sources.length ? sources.map(track => new Option(track.name, String(track.id))) : [new Option('Import accompaniment audio first', '')]));
      if (sources.some(track => String(track.id) === selected)) source.value = selected;
    }
    const select = this.$('studioModel');
    if (select.options.length !== c.models.length) select.replaceChildren(...c.models.map(model => new Option(model.label, model.id)));
    if (c.modelId) select.value = c.modelId;
    for(const option of select.options)option.disabled=isWebNN(c.backend)&&option.value!=='htdemucs_4s_onnx';
    this.$('studioBackend').value = c.backend;
    this.$('studioBackend').querySelector('[value="webgpu"]').disabled = !c.gpu;
    for(const {value,disabled} of studioBackendOptions({webgpu:c.gpu,webnn:c.webnn,modelId:c.modelId}))this.$('studioBackend').querySelector(`[value="${value}"]`).disabled=disabled;
    const savedBackend = !c.result && c.mode === 'stems' ? batches.find(batch => batch.id === c.activeSavedId)?.manifest.backend : null;
    this.$('studioBackendLabel').textContent = `${c.modelId === 'bs_roformer_sw_6s' ? 'SW 6' : 'Demucs 4'} · ${backendLabel(savedBackend ?? c.effectiveBackend ?? c.backend)}`;
    this.$('studioSeparate').hidden = Boolean(c.busy || !w.owned);
    this.$('studioSeparate').textContent = c.result || c.activeSavedId ? 'Separate again' : 'Separate instruments';
    this.$('studioSeparate').setAttribute('variant', c.hasAudio ? 'ghost' : 'primary');
    this.$('studioOriginal').hidden = this.$('studioInstruments').hidden = !c.result || !c.hasAudio;
    this.$('studioSeparate').disabled = w.saving || !w.owned || c.busy || !sources.length || !model;
    this.$('studioStop').hidden = !c.busy;
    this.$('studioSource').disabled = w.saving || c.busy;
    this.$('studioCheckCache').disabled = this.$('studioRemoveCache').disabled = c.busy || !model;
    this.$('studioInstruments').disabled = !c.hasAudio;
    this.$('studioOriginal').disabled = Boolean(w.saving);
    this.$('studioInstruments').disabled ||= Boolean(w.saving);
    this.$('studioOriginal').setAttribute('aria-pressed', String(c.mode === 'original'));
    this.$('studioInstruments').setAttribute('aria-pressed', String(c.mode === 'stems'));
    const status = `${c.status}${c.result && c.busy ? ` · ${c.result.engine.availableDuration.toFixed(1)} s ready${w.player.waiting ? ' · buffering' : ''}` : ''}`;
    if (this.$('studioStatus').textContent !== status) this.$('studioStatus').textContent = status;
    const progress = this.$('studioProgress');
    progress.hidden = !c.busy && !w.saving;
    if (c.progress === null) progress.removeAttribute('value');
    else progress.value = c.progress;
    if (this.lastModelId !== c.modelId) {
      this.lastModelId = c.modelId;
      this.$('studioCacheStatus').textContent = 'Downloaded on demand. Use Check cache to verify an existing download.';
      this.$('studioModelHelp').textContent = !model ? 'Preparing available models…' : model.id === 'htdemucs_4s_onnx'
        ? '4 instruments: drums, bass, vocals, other. Guitar is included in Other.'
        : '6 instruments with dedicated guitar and piano. GPU recommended; CPU is much slower.';
      this.$('studioModelSize').textContent = model ? `Model download: ${(model.files.reduce((sum, file) => sum + file.size, 0) / 1024 ** 2).toFixed(0)} MiB.` : '';
    }
  }
}
