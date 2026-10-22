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
