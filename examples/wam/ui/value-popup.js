// "Pan: +63" under a control's handle, for tl-knob and tl-slider with a `popup="Pan"` attribute.
// It shows while the control is hovered, dragged or used from the keyboard, and sits in the top
// layer (popover) so no scrolling or overflow clips it. The control adds popupStyles to its shadow
// styles, popupHtml to its shadow markup, and calls update(text) whenever its value is drawn.
export const popupStyles = `
  [part="popup"] { position: fixed; inset: auto; margin: 0; display: none; align-items: baseline; gap: 14px; padding: 7px 12px;
    color: var(--tl-text-2); background: var(--tl-surface-4); border: 1px solid var(--tl-border-strong); border-radius: var(--tl-radius-md);
    box-shadow: 0 6px 18px #000a; font: 500 var(--tl-fs-md)/1.2 var(--tl-font-ui); white-space: nowrap; pointer-events: none; overflow: visible; }
  [part="popup"]:popover-open { display: flex; }
  [part="popup"]::before { content: ""; position: absolute; top: -6px; left: calc(var(--arrow, 50%) - 6px); width: 10px; height: 10px; rotate: 45deg;
    background: inherit; border: 1px solid var(--tl-border-strong); border-width: 1px 0 0 1px; }
  [part="popup"] output { color: var(--tl-text); font: 600 var(--tl-fs-md)/1.2 var(--tl-font-mono); font-variant-numeric: tabular-nums; }
`;
export const popupHtml = '<span part="popup" popover="manual"><span></span><output></output></span>';

// The value an app wants shown ("−3.2 dB") goes in the input's data-popup-value; else `fallback`.
export const popupText = (input, fallback) => input?.dataset.popupValue ?? fallback;

export class ValuePopup {
  // anchor(): the element the popup points at (the knob's dial, the slider's thumb).
  constructor(host, anchor) {
    Object.assign(this, {host, anchor, hovered: false, dragging: false, keyed: false});
    this.element = host.shadowRoot.querySelector('[part="popup"]');
    host.addEventListener('pointerenter', () => { this.hovered = true; this.toggle(); });
    host.addEventListener('pointerleave', () => { this.hovered = false; this.toggle(); });
    // Keyboard use: arrows/Home/End since the last pointer press (a click also focuses the input).
    host.addEventListener('keydown', () => { this.keyed = true; this.toggle(); });
    host.addEventListener('pointerdown', () => { this.keyed = false; });
    host.addEventListener('focusout', () => queueMicrotask(() => this.toggle()));
  }
  get open() { return this.element.matches(':popover-open'); }
  drag(dragging) { this.dragging = dragging; this.toggle(); }
  hide() { this.hovered = this.dragging = false; this.toggle(); }
  update(text) {
    if (!this.host.hasAttribute('popup')) return;
    this.element.firstChild.textContent = `${this.host.getAttribute('popup')}:`;
    this.element.lastChild.textContent = text;
    if (this.open) this.place();
  }
  toggle() {
    const {host} = this, input = host.input;
    const show = host.hasAttribute('popup') && host.isConnected && !input?.disabled
      && (this.hovered || this.dragging || (this.keyed && Boolean(input?.matches(':focus'))));
    if (!this.element.showPopover || show === this.open) return;
    if (show) { host.render(); this.element.showPopover(); this.place(); } else this.element.hidePopover();
  }
  place() {
    const anchor = this.anchor().getBoundingClientRect(), popup = this.element.getBoundingClientRect();
    const centre = anchor.left + anchor.width / 2, left = Math.max(4, Math.min(innerWidth - popup.width - 4, centre - popup.width / 2));
    this.element.style.left = `${left}px`;
    this.element.style.top = `${anchor.bottom + 10}px`;
    this.element.style.setProperty('--arrow', `${centre - left}px`);
  }
}
