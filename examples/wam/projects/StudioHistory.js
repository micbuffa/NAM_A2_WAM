// Session commands retain values and immutable asset IDs, never decoded PCM.
// A failed async inverse leaves the cursor where it was. Eviction removes a
// prefix, so remaining commands always form a continuous, valid suffix.
export class StudioHistory {
  constructor({limit = 30, audioLimit = 2, changed = () => {}} = {}) {
    Object.assign(this, {limit, audioLimit, changed});
    this.entries = []; this.cursor = 0; this.busy = false; this.generation = 0;
  }
  get undoLabel() { return this.entries[this.cursor - 1]?.label ?? ''; }
  get redoLabel() { return this.entries[this.cursor]?.label ?? ''; }
  clear() { this.entries = []; this.cursor = 0; this.generation++; this.changed(); }
  record(command) {
    if (this.busy || !command) return;
    this.entries.splice(this.cursor);
    const previous = this.entries.at(-1);
    if (command.group && previous?.group === command.group && previous.merge) { previous.merge(command); if (previous.empty) this.entries.pop(); }
    else this.entries.push(command);
    while (this.entries.length > this.limit || this.entries.filter(entry => entry.audio).length > this.audioLimit) this.entries.shift();
    this.cursor = this.entries.length; this.changed();
  }
  async step(redo = false) {
    if (this.busy) return false;
    const command = this.entries[redo ? this.cursor : this.cursor - 1];
    if (!command) return false;
    const generation = this.generation;
    this.busy = true; this.changed();
    try {
      await command[redo ? 'redo' : 'undo']();
      if (generation !== this.generation) return false;
      this.cursor += redo ? 1 : -1;
      return true;
    } finally { this.busy = false; this.changed(); }
  }
}

const FIELDS = ['name', 'instrument', 'presetId', 'factoryPreset', 'volume', 'pan', 'mute', 'solo'];
export function editState(project, loop) {
  return {name: project.name, bpm: project.bpm, loop: loop && {...loop},
    tracks: project.tracks.map(track => Object.fromEntries(['id', ...FIELDS].map(key => [key, track[key]])))};
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Only changed fields are replayed: another track's monitoring and saved
// baseline must not be restored from an old whole-project snapshot.
export function editPatch(before, after) {
  const patch = {project: {}, tracks: [], order: null, loop: null};
  for (const key of ['name', 'bpm']) if (before[key] !== after[key]) patch.project[key] = [before[key], after[key]];
  for (const track of before.tracks) {
    const next = after.tracks.find(entry => entry.id === track.id);
    if (!next) continue;
    const fields = {};
    for (const key of FIELDS) if (track[key] !== next[key]) fields[key] = [track[key], next[key]];
    if (Object.keys(fields).length) patch.tracks.push({id: track.id, fields});
  }
  const order = [before.tracks.map(t => t.id), after.tracks.map(t => t.id)];
  if (!same(order[0], order[1])) patch.order = order;
  if (!same(before.loop, after.loop)) patch.loop = [before.loop, after.loop];
  return Object.keys(patch.project).length || patch.tracks.length || patch.order || patch.loop ? patch : null;
}
export function editCommand(before, after, {label, group, apply}) {
  const patch = editPatch(before, after);
  if (!patch) return null;
  return {label, group, before, after, get empty() { return !editPatch(before, after); }, undo: () => apply(editPatch(before, after), 0), redo: () => apply(editPatch(before, after), 1),
    merge(command) { after = command.after; this.after = after; }};
}

export function historyShortcut(event, {mac = false, visible = false, blocked = false} = {}) {
  if (!visible || blocked || event.isComposing || event.defaultPrevented || event.repeat || event.altKey || event.getModifierState?.('AltGraph')) return null;
  if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return null;
  const path = event.composedPath?.() ?? [event.target];
  if (path.some(node => node?.matches?.('input:not([type="range"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], dialog, [role="dialog"], iframe') || node?.isContentEditable)) return null;
  // Plugin-owned shadow DOM keeps its keyboard handling; Studio range controls
  // are allowed, since they don't have a native text undo stack.
  if (path.some(node => node?.tagName?.includes('-') && !node.tagName.startsWith('TL-'))) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (!mac && key === 'y' && !event.shiftKey) return 'redo';
  return null;
}
