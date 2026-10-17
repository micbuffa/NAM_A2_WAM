import test from 'node:test';
import assert from 'node:assert/strict';
import {installLightDismiss, isOutside} from '../../examples/wam/ui/light-dismiss.js';

const rect = {left: 100, right: 300, top: 50, bottom: 250};

test('only points beyond the dialog box are outside', () => {
  assert.equal(isOutside(rect, 200, 100), false);
  assert.equal(isOutside(rect, 100, 250), false, 'the border belongs to the dialog');
  assert.equal(isOutside(rect, 99, 100), true);
  assert.equal(isOutside(rect, 200, 260), true);
});

const fakeDialog = ({prevent = false} = {}) => {
  const dialog = Object.assign(new EventTarget(), {localName: 'dialog', open: true, closed: 0,
    getBoundingClientRect: () => rect, close() { this.open = false; this.closed++; }});
  if (prevent) dialog.addEventListener('cancel', (event) => event.preventDefault());
  return dialog;
};
const press = (root, target, [downX, downY], [upX, upY] = [downX, downY]) => {
  root.dispatchEvent(Object.assign(new Event('pointerdown'), {fakeTarget: target, clientX: downX, clientY: downY}));
  root.dispatchEvent(Object.assign(new Event('click'), {fakeTarget: target, clientX: upX, clientY: upY}));
};

// Event.target is read-only on dispatched events: the root forwards a fake one.
const fakeRoot = () => {
  const root = new EventTarget();
  const add = root.addEventListener.bind(root);
  root.addEventListener = (type, listener, capture) => add(type, (event) => listener({target: event.fakeTarget, clientX: event.clientX, clientY: event.clientY}), capture);
  return root;
};

test('a click on the backdrop cancels then closes the dialog, like Esc', () => {
  const root = fakeRoot();
  const uninstall = installLightDismiss(root);
  const dialog = fakeDialog();
  let cancels = 0;
  dialog.addEventListener('cancel', () => cancels++);
  press(root, dialog, [200, 100]);
  assert.equal(dialog.closed, 0, 'a click on the dialog padding keeps it open');
  press(root, dialog, [200, 100], [10, 10]);
  assert.equal(dialog.closed, 0, 'a press started inside the dialog keeps it open');
  press(root, {localName: 'button'}, [10, 10]);
  assert.equal(dialog.closed, 0, 'clicks on other elements are ignored');
  press(root, dialog, [10, 10]);
  assert.deepEqual([cancels, dialog.closed], [1, 1]);
  uninstall();
});

test('a dialog that handles cancel itself decides how to close', () => {
  const root = fakeRoot();
  const uninstall = installLightDismiss(root);
  const dialog = fakeDialog({prevent: true});
  press(root, dialog, [10, 10]);
  assert.equal(dialog.closed, 0);
  uninstall();
});
