/**
 * Single source of truth for how each internal state is presented in the new
 * Javi UI: the Spanish label, the poetic caption, and the orb's particle shape
 * + rotation. Both the orb and the HUD import this so the mapping never drifts.
 *
 * Internal State enum (idle/listening/thinking/speaking) stays English so the
 * brain/audio layer is untouched; only the presentation is localized here.
 */
import { State } from '../state/machine.js';

export const STATE_UI = {
  [State.IDLE]: {
    label: 'En reposo',
    caption: 'Aquí estoy cuando me necesites',
    shape: 'ring',
    spin: '72s',
  },
  [State.LISTENING]: {
    label: 'Escuchando',
    caption: 'Te escucho…',
    shape: 'orbit',
    spin: '55s',
  },
  [State.THINKING]: {
    label: 'Pensando',
    caption: 'Déjame pensar…',
    shape: 'scatter',
    spin: null, // scatter doesn't rotate
  },
  [State.SPEAKING]: {
    label: 'Hablando',
    caption: 'Aquí va…',
    shape: 'spiral',
    spin: '90s',
  },
};
