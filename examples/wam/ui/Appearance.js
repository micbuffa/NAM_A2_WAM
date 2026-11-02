import {appendTrackControlPreference} from './TrackControlStyle.js';
export function registerAppearance(settings, appearance = globalThis.NamAppearance, trackControls = null) {
  settings.addSection({id: 'appearance', label: 'Appearance', icon: 'sliders', order: 3, render(container) {
    const heading = document.createElement('h3'); heading.textContent = 'Appearance';
    const label = document.createElement('label'); label.htmlFor = 'appearanceTheme'; label.textContent = 'Theme';
    const select = document.createElement('select'); select.id = 'appearanceTheme';
    for (const [value, text] of [['dark', 'Dark'], ['light', 'Studio Light'], ['warm', 'Warm Studio'], ['system', 'Follow system']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    select.value = appearance.preference;
    select.onchange = () => appearance.set(select.value);
    const sync = () => { select.value = appearance.preference; };
    globalThis.addEventListener('nam-appearance-change', sync);
    const note = document.createElement('p'); note.className = 'host-help';
    note.textContent = 'Applies to Tone, Studio and host dialogs. Saved on this browser. Plugin interfaces may keep their own appearance.';
    const field = document.createElement('div'); field.className = 'appearance-field'; field.append(label, select);
    container.append(heading, field, note);
    const release=trackControls?appendTrackControlPreference(container,trackControls):null;
    return () => {globalThis.removeEventListener('nam-appearance-change', sync);release?.();};
  }});
}
