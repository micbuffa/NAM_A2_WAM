import {createAmpModule} from '../shared/plugin.js';
import Engine from './Engine.js';
import presetMenu from './preset-menu.js';
export default createAmpModule("modernmetal", Engine, new URL('./', import.meta.url), presetMenu);
