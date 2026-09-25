// Small promise-based wrappers around native <dialog> (focus trapping, Esc
// and the top layer come for free). Styled by .host-dialog in host.css.
let sequence = 0;

export function createDialog({title, className = ''}) {
  const id = `host-dialog-${++sequence}`;
  const dialog = document.createElement('dialog');
  dialog.className = `host-dialog ${className}`.trim();
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  const heading = document.createElement('h2');
  heading.id = `${id}-title`;
  heading.textContent = title;
  const body = document.createElement('div');
  body.className = 'host-dialog-body';
  dialog.append(heading, body);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), {once: true});
  return {dialog, heading, body, id};
}

export function actionsRow(...buttons) {
  const row = document.createElement('div');
  row.className = 'host-dialog-actions';
  row.append(...buttons);
  return row;
}

export function button(label, {type = 'button', primary = false, value = ''} = {}) {
  const element = document.createElement('button');
  element.type = type;
  element.textContent = label;
  if (value) element.value = value;
  if (primary) element.className = 'host-primary';
  return element;
}

// Resolves with the trimmed text, or null when cancelled.
export function promptDialog({title, label, value = '', confirmLabel = 'Save', maxLength = 100}) {
  return new Promise((resolve) => {
    const {dialog, body, id} = createDialog({title});
    const form = document.createElement('form');
    form.method = 'dialog';
    const field = document.createElement('label');
    field.textContent = label;
    field.htmlFor = `${id}-input`;
    const input = document.createElement('input');
    input.id = `${id}-input`;
    input.required = true;
    input.maxLength = maxLength;
    input.value = value;
    input.autocomplete = 'off';
    const cancel = button('Cancel', {value: 'cancel'});
    cancel.onclick = () => dialog.close('cancel');
    form.append(field, input, actionsRow(cancel, button(confirmLabel, {type: 'submit', primary: true, value: 'ok'})));
    body.append(form);
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok' && input.value.trim() ? input.value.trim() : null), {once: true});
    dialog.showModal();
    input.select();
  });
}

export function confirmDialog({title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel'}) {
  return new Promise((resolve) => {
    const {dialog, body} = createDialog({title});
    const text = document.createElement('p');
    text.textContent = message;
    const form = document.createElement('form');
    form.method = 'dialog';
    const cancel = button(cancelLabel, {type: 'submit', value: 'cancel'});
    form.append(actionsRow(cancel, button(confirmLabel, {type: 'submit', primary: true, value: 'ok'})));
    body.append(text, form);
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), {once: true});
    dialog.showModal();
    cancel.focus();
  });
}
