// Builds a native <dialog class="tl-modal"> (styled by ui/components.css) with a header
// (eyebrow, title, close button) and a body. The dialog is removed from the DOM once closed
// unless `persistent` is set. The close button closes with returnValue 'cancel'.
// No imports on purpose: account code using it is unit-tested under Node. The page loads ui/index.js
// (which defines <tl-icon-button>) before any modal opens.
let sequence = 0;

export function createModal({title, eyebrow = '', className = '', wide = false, persistent = false}) {
  const id = `tl-modal-${++sequence}`;
  const dialog = document.createElement('dialog');
  dialog.className = ['tl-modal', wide && 'tl-modal-wide', className].filter(Boolean).join(' ');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  const header = document.createElement('header');
  header.className = 'tl-modal-header';
  const titles = document.createElement('div');
  const kicker = Object.assign(document.createElement('p'), {className: 'tl-eyebrow', textContent: eyebrow});
  const heading = Object.assign(document.createElement('h2'), {id: `${id}-title`, className: 'tl-modal-title', textContent: title});
  titles.append(kicker, heading);
  const close = document.createElement('tl-icon-button');
  close.setAttribute('icon', 'close');
  close.setAttribute('variant', 'ghost');
  close.setAttribute('aria-label', 'Close');
  close.onclick = () => dialog.close('cancel');
  header.append(titles, close);
  const body = Object.assign(document.createElement('div'), {className: 'tl-modal-body'});
  dialog.append(header, body);
  document.body.append(dialog);
  if (!persistent) dialog.addEventListener('close', () => dialog.remove(), {once: true});
  return {dialog, header, heading, body, id};
}

export function modalActions(...buttons) {
  const row = document.createElement('div');
  row.className = 'tl-modal-actions';
  row.append(...buttons);
  return row;
}

// Native <button> styled as a TONELAB button: required for form submitters inside dialogs.
export function modalButton(label, {type = 'button', variant = '', value = ''} = {}) {
  const element = document.createElement('button');
  element.type = type;
  element.textContent = label;
  element.className = variant ? `tl-btn tl-btn-${variant}` : 'tl-btn';
  if (value) element.value = value;
  return element;
}
