// Small promise-based wrappers around native <dialog> (focus trapping, Esc
// and the top layer come for free). Built on the TONELAB modal (ui/modal.js,
// styled by .tl-modal in ui/components.css).
import {createModal, modalActions, modalButton} from '../ui/modal.js';

export function createDialog({title, className = ''}) {
  const {dialog, heading, body, id} = createModal({title, className});
  return {dialog, heading, body, id};
}

export const actionsRow = modalActions;

export function button(label, {type = 'button', primary = false, value = ''} = {}) {
  return modalButton(label, {type, value, variant: primary ? 'primary' : ''});
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
