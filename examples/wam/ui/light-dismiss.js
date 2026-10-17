// Light dismiss for modal <dialog>s: a click on the backdrop, outside the
// dialog box, does what Esc does. The dialog gets a cancelable 'cancel' event
// (dialogs with their own Esc handling keep it), then closes unless prevented.
// A press that starts inside the dialog (text selection, knob drag) and ends
// outside does not count. Not closedby="any": Safari does not support it yet.
export const isOutside = (rect, x, y) => x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

// A click whose target is the dialog element itself landed on the dialog's
// padding or on its ::backdrop; only the backdrop is outside its box.
const backdropDialog = (event) => {
  const dialog = event.target;
  return dialog?.localName === 'dialog' && dialog.open && isOutside(dialog.getBoundingClientRect(), event.clientX, event.clientY) ? dialog : null;
};

export function dismiss(dialog) {
  if (dialog.dispatchEvent(new Event('cancel', {cancelable: true}))) dialog.close();
}

export function installLightDismiss(root = document) {
  let pressed = null;
  const down = (event) => { pressed = backdropDialog(event); };
  const click = (event) => {
    const dialog = backdropDialog(event);
    const started = pressed;
    pressed = null;
    if (dialog && dialog === started) dismiss(dialog);
  };
  root.addEventListener('pointerdown', down, true);
  root.addEventListener('click', click, true);
  return () => { root.removeEventListener('pointerdown', down, true); root.removeEventListener('click', click, true); };
}
