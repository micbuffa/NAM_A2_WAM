// Synchronous head bootstrap: restore colours before the body is painted.
// Kept independent of the audio engine and accounts; preference is browser-local.
(() => {
  const key = 'nam-a2.appearance';
  const choices = Object.freeze(['dark', 'light', 'warm', 'system']);
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  let preference = 'dark';
  try { const saved = localStorage.getItem(key); if (choices.includes(saved)) preference = saved; } catch { /* Private/blocked storage: session-only. */ }
  const apply = () => {
    const theme = preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    globalThis.dispatchEvent(new CustomEvent('nam-appearance-change', {detail: {preference, theme}}));
  };
  const set = value => {
    if (!choices.includes(value)) throw new RangeError('Unknown appearance');
    preference = value;
    try { localStorage.setItem(key, value); } catch { /* Keep working without persistence. */ }
    apply();
  };
  media?.addEventListener('change', () => { if (preference === 'system') apply(); });
  globalThis.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = choices.includes(event.newValue) ? event.newValue : 'dark'; apply();
  });
  globalThis.NamAppearance = Object.freeze({choices, get preference() { return preference; }, set});
  apply();
})();
