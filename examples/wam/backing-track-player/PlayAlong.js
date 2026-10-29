// Play along (Tone): one player at a time. Starting the backing track pauses
// the open project and the other way round; leaving Tone pauses the backing
// track. Returns a function that removes the links.
export function linkPlayAlong({engine, projectPlayer, workspaces}) {
  const abort = new AbortController(), {signal} = abort;
  engine.addEventListener('transport-change', () => {
    if (engine.playing && projectPlayer.playing) projectPlayer.pause();
  }, {signal});
  projectPlayer.addEventListener('statechange', () => {
    if (projectPlayer.playing && engine.playing) engine.pause();
  }, {signal});
  workspaces.addEventListener('change', () => {
    if (workspaces.current !== 'tone' && engine.playing) engine.pause();
  }, {signal});
  return () => abort.abort();
}

// Inputs Space types into (it keeps typing there); other inputs are controls.
const CONTROL_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);
export function typesSpace(element) {
  if (!element?.closest) return false;
  if (element.closest('textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
  return element.localName === 'input' && !CONTROL_INPUTS.has(element.type);
}

// What Space does: pause whichever player plays, else play the shown
// workspace's (Tone: the backing track, Projects: the open project); null when
// there is nothing to play.
export function spaceAction({engine, projectPlayer, workspace}) {
  if (projectPlayer.playing) return () => projectPlayer.pause();
  if (engine.playing) return () => engine.pause();
  if (workspace === 'projects') return projectPlayer.duration ? () => projectPlayer.play() : null;
  return engine.buffer && !engine.loading ? () => engine.play() : null;
}

// Space plays or pauses in both workspaces, also on a focused button or
// slider (Enter still activates it), but not while typing or in a dialog. It
// is caught before any control (capture), with its keyup, which would click
// a native button. run(operation) reports a failed play. Returns a function
// that removes it.
export function linkSpaceKey({engine, projectPlayer, workspaces, root = document, run = (operation) => Promise.resolve().then(operation), isTrackEditing = () => false}) {
  const abort = new AbortController(), options = {capture: true, signal: abort.signal};
  const transportKey = (event) => event.key === ' ' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
    && !typesSpace(event.composedPath?.()[0] ?? event.target) && !root.querySelector?.('dialog[open]');
  root.addEventListener('keydown', (event) => {
    if (!transportKey(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const action = !event.repeat && spaceAction({engine, projectPlayer, workspace: isTrackEditing() ? 'projects' : workspaces.current});
    if (action) run(action);
  }, options);
  root.addEventListener('keyup', (event) => {
    if (!transportKey(event)) return;
    event.preventDefault();
    event.stopPropagation();
  }, options);
  return () => abort.abort();
}
