// Topbar audio engine badge (#engineStatus), as in the TONELAB mockup: its dot
// and text follow the AudioContext. data-state is starting (rack not built
// yet), ready (running), idle (suspended until live input or playback) or
// offline (closed, interrupted, or the rack failed to start).
const STATES = {
  starting: {tone: 'warning', text: () => 'Starting audio engine…'},
  ready: {tone: 'accent', live: true, text: (context) => `Audio engine ready · ${context.sampleRate / 1000} kHz`},
  idle: {tone: 'neutral', text: () => 'Audio engine idle', title: 'Starts with live input or playback'},
  offline: {tone: 'danger', live: true, text: () => 'Audio engine offline'},
};

export class EngineStatus {
  constructor({element, context}) {
    Object.assign(this, {element, context, started: false, failed: false});
    context.addEventListener('statechange', () => this.render());
    this.render();
  }

  get state() {
    if (this.failed) return 'offline';
    if (!this.started) return 'starting';
    return {running: 'ready', suspended: 'idle'}[this.context.state] || 'offline';
  }

  // The rack is built: from now on the badge follows the context state.
  ready() { this.started = true; this.render(); }
  fail() { this.failed = true; this.render(); }

  render() {
    const state = this.state;
    const {tone, live = false, text, title = ''} = STATES[state];
    this.element.dataset.state = state;
    this.element.setAttribute('tone', tone);
    this.element.toggleAttribute('live', live);
    this.element.textContent = text(this.context);
    this.element.title = title;
  }
}
