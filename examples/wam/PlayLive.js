import {AudioLevel} from './AudioLevel.js';

// Play live (Play page): the guitar through the rack, with or without a backing
// track. The card names the live input and the current preset, and meters the
// guitar with its own tap on the rack input (never connected to the output),
// read only while the input is on and Play is shown. Over an open backing track
// (setOverTrack) with the input off, a reminder replaces the input/preset line.
// Adds nothing to the audio graph: it only reads.
export class PlayLive {
  constructor({root = document, context, input, source, workspaces, isLive}) {
    Object.assign(this, {context, source, workspaces, isLive});
    const $ = (id) => root.getElementById(id);
    Object.assign(this, {card: $('playLive'), inputLabel: $('playLiveInput'), preset: $('playLivePreset'), meter: $('playLiveMeter'), presetTitle: $('presetTitle')});
    this.level = new AudioLevel(context, input);
    this.abort = new AbortController();
    const {signal} = this.abort;
    workspaces.addEventListener('change', () => this.sync(), {signal});
    document.addEventListener('visibilitychange', () => this.sync(), {signal});
    // The dock header shows the current preset: mirror its title.
    this.presetObserver = new MutationObserver(() => this.syncPreset());
    if (this.presetTitle) this.presetObserver.observe(this.presetTitle, {childList: true, characterData: true, subtree: true});
    this.syncPreset();
    this.sync();
  }

  // Over an open backing track, with the input off, the card reminds that
  // the guitar is not heard.
  setOverTrack(overTrack) {
    this.card.toggleAttribute('data-track', Boolean(overTrack));
  }

  syncPreset() {
    const name = this.presetTitle?.textContent.trim() || 'Untitled rack';
    this.preset.textContent = name;
    this.preset.title = name;
  }

  // Called whenever the live input turns on or off (and on workspace changes).
  sync() {
    const live = Boolean(this.isLive()), input = this.source.liveInput;
    this.card.dataset.live = live ? 'on' : 'off';
    const label = live ? [input?.label || 'Live input', input?.channelCount > 1 ? `input ${Number(input.channelIndex || 0) + 1}` : null].filter(Boolean).join(' · ') : 'Input off';
    this.inputLabel.textContent = label;
    this.inputLabel.title = label;
    const metering = live && this.workspaces.current === 'tone' && !document.hidden;
    if (metering && !this.animation) this.animate();
    if (!metering) this.stop();
  }

  animate() {
    const tick = (now) => {
      if (!this.lastRead || now - this.lastRead >= 33) {
        this.lastRead = now;
        const value = this.level.read();
        this.meter.style.setProperty('--meter-level', String(value.level));
        this.meter.setAttribute('aria-valuenow', Math.max(-60, Math.min(0, value.db)).toFixed(1));
        if (value.peak >= 1) this.clipUntil = now + 1000;
        this.meter.classList.toggle('is-clipping', now < (this.clipUntil || 0));
      }
      this.animation = requestAnimationFrame(tick);
    };
    this.animation = requestAnimationFrame(tick);
  }

  stop() {
    if (this.animation) cancelAnimationFrame(this.animation);
    this.animation = null;
    this.meter.style.setProperty('--meter-level', '0');
    this.meter.removeAttribute('aria-valuenow');
    this.meter.classList.remove('is-clipping');
  }

  destroy() {
    this.stop();
    this.abort.abort();
    this.presetObserver.disconnect();
    this.level.destroy();
  }
}
