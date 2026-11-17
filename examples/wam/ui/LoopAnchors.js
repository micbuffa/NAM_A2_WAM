// Shared loop gestures and A/B markers. The caller supplies its time grid and transport.
export class LoopAnchors {
  constructor({surface, root = surface, duration, minimum, step, resize, draw, formatTime, onSeek, onLoop, available = () => true, signal}) {
    Object.assign(this, {surface, root, duration, minimum, step, resize, draw, formatTime, onSeek, onLoop, available});
    this.loop = {enabled: false, start: 0, end: 0};
    this.anchors = ['A', 'B'].map(name => {
      const button = document.createElement('button');
      button.className = `loop-anchor loop-anchor-${name.toLowerCase()}`;
      button.type = 'button';
      button.textContent = name;
      button.dataset.loopAnchor = name;
      button.setAttribute('role', 'slider');
      button.setAttribute('aria-label', `Loop ${name === 'A' ? 'start A' : 'end B'}`);
      button.title = `Drag ${name} to resize the loop · Arrow keys to move · Alt for finer control`;
      button.onkeydown = event => this.keydown(event, name);
      return button;
    });
    surface.addEventListener('pointerdown', event => this.pointerDown(event), {signal});
    surface.addEventListener('pointermove', event => this.pointerMove(event), {signal});
    surface.addEventListener('pointerup', event => this.pointerUp(event), {signal});
    for (const type of ['pointercancel', 'lostpointercapture']) {
      surface.addEventListener(type, event => {
        if (this.drag?.pointerId === event.pointerId) this.cancel();
      }, {signal});
    }
  }

  get bounds() {
    return this.loop.end > this.loop.start ? this.loop : {start: 0, end: this.duration()};
  }

  timeAt(x) {
    const {left, width} = this.surface.getBoundingClientRect();
    return width ? Math.max(0, Math.min(1, (x - left) / width)) * this.duration() : 0;
  }

  keydown(event, name) {
    if (!this.available()) return;
    const {start, end} = this.bounds;
    const position = name === 'A' ? start : end;
    const step = event.altKey ? .1 : this.step();
    const time = {ArrowLeft: position - step, ArrowRight: position + step, Home: 0, End: this.duration()}[event.key];
    if (time === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    this.onLoop(this.resize(this.bounds, name, time, event.altKey));
  }

  pointerDown(event) {
    if (!this.available() || event.button !== 0 || this.drag) return;
    const anchor = event.target.closest?.('[data-loop-anchor]')?.dataset.loopAnchor;
    const from = this.timeAt(event.clientX);
    const bounds = this.bounds;
    const {left, width} = this.surface.getBoundingClientRect();
    const edge = anchor === 'A' ? bounds.start : bounds.end;
    const offset = anchor ? event.clientX - (left + edge / this.duration() * width) : 0;
    this.drag = {x: event.clientX, from, offset, anchor, bounds, pointerId: event.pointerId, moved: false};
    this.surface.setPointerCapture?.(event.pointerId);
  }

  rangeAt(event, drag) {
    const time = this.timeAt(event.clientX - drag.offset);
    return drag.anchor ? this.resize(drag.bounds, drag.anchor, time, event.altKey) : this.draw(drag.from, time, event.altKey);
  }

  pointerMove(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId || (!drag.moved && Math.abs(event.clientX - drag.x) < 4)) return;
    drag.moved = true;
    this.render({enabled: true, ...this.rangeAt(event, drag)});
  }

  pointerUp(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    this.cancel();
    if (!this.available()) return;
    if (drag.moved) this.onLoop(this.rangeAt(event, drag));
    else if (!drag.anchor) this.onSeek(drag.from);
  }

  cancel() {
    if (!this.drag) return;
    this.drag = null;
    this.render();
  }

  setLoop(loop) {
    this.loop = loop;
    if (!this.drag?.moved) this.render();
  }

  render(loop = this.loop) {
    const duration = this.duration();
    const scale = duration || 1;
    const {enabled, start, end} = loop;
    const hasLoop = end > start;
    const a = hasLoop ? Math.min(start, duration) : 0;
    const b = hasLoop ? Math.min(end, duration) : duration;
    const fraction = time => Math.max(0, Math.min(1, time / scale));
    const gap = Math.min(this.minimum, duration);
    const {style, classList} = this.root;
    style.setProperty('--loop-start', String(fraction(a)));
    style.setProperty('--loop-end', String(fraction(b)));
    classList.toggle('has-loop', hasLoop && duration > 0);
    classList.toggle('loop-off', !enabled);
    classList.toggle('short-loop', duration > 0 && (b - a) / scale * this.surface.clientWidth < 44);
    for (const [index, anchor] of this.anchors.entries()) {
      const time = index ? b : a;
      anchor.hidden = duration <= 0;
      anchor.style.left = `${fraction(time) * 100}%`;
      anchor.setAttribute('aria-valuemin', String(index ? Math.min(b, a + gap) : 0));
      anchor.setAttribute('aria-valuemax', String(index ? duration : Math.max(a, b - gap)));
      anchor.setAttribute('aria-valuenow', String(time));
      anchor.setAttribute('aria-valuetext', this.formatTime(time));
    }
  }
}
