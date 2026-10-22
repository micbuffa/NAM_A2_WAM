import {define, shadow} from '../define.js';
import './tl-icon.js';

// <tl-toast> — bottom-centre notification stack. Use the `toast()` helper rather than the element:
//   toast('Preset saved'); toast('Audio device lost', {tone: 'danger', duration: 6000});
// Messages are announced politely (role=status); danger ones assertively (role=alert).
const styles = `
  :host { position: fixed; left: 50%; bottom: var(--tl-toast-offset, 24px); z-index: 2147483000; display: flex; flex-direction: column; align-items: center; gap: 8px;
    transform: translateX(-50%); pointer-events: none; }
  /* popover puts the stack in the top layer, above open modal dialogs; undo the UA popover box. */
  :host([popover]) { inset: auto auto var(--tl-toast-offset, 24px) 50%; margin: 0; padding: 0; border: 0; background: none; overflow: visible; color: inherit; }
  .toast { --tone: var(--tl-accent); display: flex; align-items: center; gap: 10px; max-width: min(520px, calc(100vw - 32px)); padding: 10px 14px;
    color: var(--tl-text); background: var(--tl-surface-4); border: 1px solid var(--tl-border-strong); border-radius: var(--tl-radius-md);
    box-shadow: var(--tl-shadow-module); font-size: var(--tl-fs-sm); font-weight: 500; line-height: 1.35; pointer-events: auto;
    animation: in .18s ease-out; }
  .toast.out { opacity: 0; transform: translateY(6px); transition: opacity .2s, transform .2s; }
  .toast[data-tone="danger"] { --tone: var(--tl-danger); border-color: color-mix(in srgb, var(--tl-danger) 45%, var(--tl-border-strong)); }
  .toast[data-tone="warning"] { --tone: var(--tl-warning); }
  .toast[data-tone="neutral"] { --tone: var(--tl-text-muted); }
  i { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--tone); box-shadow: 0 0 8px var(--tone); }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } }
  @media (prefers-reduced-motion: reduce) { .toast { animation: none; } .toast.out { transition: none; } }
`;

export class TlToast extends HTMLElement {
  constructor() { super(); shadow(this, styles); }
  connectedCallback() { if ('popover' in HTMLElement.prototype) this.popover = 'manual'; }
  // Re-showing moves the popover to the top of the top layer, above a dialog opened since.
  raise() { if (!this.popover) return; if (this.matches(':popover-open')) this.hidePopover(); this.showPopover(); }
  show(text, {tone = 'accent', duration = 2400} = {}) {
    const item = document.createElement('div');
    item.className = 'toast';
    item.dataset.tone = tone;
    item.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    item.append(document.createElement('i'), text);
    this.shadowRoot.append(item);
    while (this.shadowRoot.childElementCount > 3) this.shadowRoot.firstElementChild.remove();
    this.raise();
    setTimeout(() => { item.classList.add('out'); setTimeout(() => { item.remove(); if (!this.shadowRoot.childElementCount) this.hidePopover?.(); }, 220); }, duration);
    return item;
  }
}
define('tl-toast', TlToast);

export function toast(text, options) {
  let host = document.querySelector('body > tl-toast');
  if (!host) { host = document.createElement('tl-toast'); document.body.append(host); }
  return host.show(text, options);
}
