/**
 * Bottom dock: the segmented state control and the input bar (mic · input ·
 * send). Renders the segments, wires DOM events to callbacks, and exposes
 * setters so the app can reflect the active state / mic / send styling.
 *
 * The segmented control is both an indicator and a control: the active segment
 * always follows the real state, and the actionable segments (Escuchando /
 * En reposo) toggle listening. The transient ones (Pensando / Hablando) are
 * display-only — they light up when Javi is in that state but aren't clickable.
 */
export function createControls(
  { segmented, micBtn, input, sendBtn, dock, revealBtn },
  { states, sttAvailable, onSegment, onMicToggle, onSend, onInput }
) {
  const segEls = {};
  segmented.innerHTML = '';
  for (const s of states) {
    const el = document.createElement('button');
    el.className = 'seg' + (s.actionable ? '' : ' static');
    el.textContent = s.label;
    if (s.actionable) el.addEventListener('click', () => onSegment(s.key));
    segmented.appendChild(el);
    segEls[s.key] = el;
  }

  // Dock reveal/collapse — pure local view state (per ADR-001, kept out of the
  // conversational state machine). Toggles a class; CSS handles the slide.
  revealBtn.addEventListener('click', () => {
    const expanded = dock.classList.toggle('expanded');
    revealBtn.setAttribute('aria-expanded', String(expanded));
    revealBtn.title = expanded ? 'Ocultar controles' : 'Mostrar controles';
    if (expanded) input.focus();
  });

  sendBtn.addEventListener('click', () => onSend(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSend(input.value);
  });
  input.addEventListener('input', () => onInput?.(input.value));

  if (sttAvailable) {
    micBtn.addEventListener('click', () => onMicToggle());
  } else {
    micBtn.disabled = true;
    micBtn.title = 'Reconocimiento de voz no disponible (usa Chrome)';
  }

  return {
    setActiveSegment(key) {
      for (const k in segEls) segEls[k].classList.toggle('active', k === key);
    },
    setMicActive(on) {
      micBtn.classList.toggle('active', on);
    },
    setSendActive(on) {
      sendBtn.classList.toggle('active', on);
    },
    clearInput() {
      input.value = '';
    },
    setInput(text) {
      input.value = text;
    },
    getInput() {
      return input.value;
    },
  };
}
