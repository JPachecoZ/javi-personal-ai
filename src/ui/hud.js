/**
 * Heads-up display: the header status (dot + state label) and the center
 * caption. Pure presentation — it renders what it's told.
 *
 * The caption doubles as the conversation surface in this minimal design: it
 * shows the poetic state line when idle, the live interim transcript while
 * listening, and the streaming reply while Javi answers. `main.js` decides
 * which; the HUD just displays it (and re-triggers a fade on each change).
 */
export function createHUD({ statusDot, stateLabel, caption }) {
  return {
    /** kind: 'normal' | 'error'. */
    setDot(kind = 'normal') {
      statusDot.className = 'status-dot' + (kind === 'error' ? ' error' : '');
    },

    setStateLabel(text) {
      stateLabel.textContent = text;
    },

    setCaption(text) {
      if (caption.textContent === text) return;
      caption.textContent = text;
      // Restart the fade-up animation on every change.
      caption.classList.remove('flash');
      void caption.offsetWidth;
      caption.classList.add('flash');
    },
  };
}
