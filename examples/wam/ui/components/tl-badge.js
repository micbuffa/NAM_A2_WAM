import {define, shadow} from '../define.js';

// <tl-badge tone="neutral|accent|warning|danger|success" dot live>Audio engine ready</tl-badge>
// `dot` shows a status dot; `live` makes it glow (engine/LED status).
const styles = `
  :host { --tone: var(--tl-text-muted); display: inline-flex; align-items: center; gap: 7px; color: var(--tl-text-2);
    font-size: var(--tl-fs-sm); font-weight: 500; line-height: 1.2; white-space: nowrap; }
  :host([tone="accent"]) { --tone: var(--tl-accent); }
  :host([tone="warning"]) { --tone: var(--tl-warning); }
  :host([tone="danger"]) { --tone: var(--tl-danger); }
  :host([tone="success"]) { --tone: var(--tl-success); }
  :host([variant="eyebrow"]) { color: var(--tone); font-size: var(--tl-fs-xs); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
  [part="dot"] { display: none; width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--tone); }
  :host([dot]) [part="dot"] { display: block; }
  :host([live]) [part="dot"] { box-shadow: 0 0 9px var(--tone); }
`;

export class TlBadge extends HTMLElement {
  constructor() { super(); shadow(this, styles, '<i part="dot"></i><slot></slot>'); }
}
define('tl-badge', TlBadge);
