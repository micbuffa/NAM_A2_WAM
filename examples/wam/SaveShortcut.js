// ⌘S on Mac, Ctrl+S elsewhere: saves what the current workspace saves (Save Preset in
// Play, Save project in Studio) by pressing that button, so its own rules apply
// (disabled while there is nothing to save, sign-in prompt, track sound dialog).

export const SAVE_SHORTCUT_LABEL = mac => mac ? '⌘S' : 'Ctrl+S';
export const SAVE_SHORTCUT_ARIA = mac => mac ? 'Meta+S' : 'Control+S';

// 'save' to save, 'ignore' to only stop the browser's "Save page as", null to leave the event alone.
// Typing in a field and dialogs other than the FX editor (its rack is the preset) keep it from saving.
export function saveShortcut(event, {mac = false} = {}) {
  if (event.isComposing || event.defaultPrevented || event.altKey || event.shiftKey || event.getModifierState?.('AltGraph')) return null;
  if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return null;
  if (event.key?.toLowerCase() !== 's') return null;
  if (event.repeat) return 'ignore';
  const path = event.composedPath?.() ?? [event.target];
  if (path.some(node => node?.matches?.('input:not([type="range"]):not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') || node?.isContentEditable)) return 'ignore';
  const dialogs = [...(event.target?.ownerDocument ?? globalThis.document)?.querySelectorAll?.('dialog[open]') ?? []];
  if (dialogs.some(dialog => !dialog.classList.contains('fx-editor'))) return 'ignore';
  return 'save';
}

export function installSaveShortcut({root = globalThis.document, workspaces, buttons, mac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')}) {
  const target = () => buttons[workspaces.current]?.();
  root.addEventListener('keydown', event => {
    const action = saveShortcut(event, {mac});
    if (!action) return;
    event.preventDefault();
    const button = action === 'save' && target();
    // Hidden (no account, shared project) or disabled (nothing to save): nothing happens.
    if (button?.offsetParent && !button.disabled) button.click();
  });
  return {label: SAVE_SHORTCUT_LABEL(mac), aria: SAVE_SHORTCUT_ARIA(mac)};
}
