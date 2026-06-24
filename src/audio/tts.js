/**
 * Text-to-speech via the browser's speechSynthesis.
 *
 * Sentences are queued so streamed chunks from the model don't overlap. Word
 * `boundary` events are surfaced via `onBoundary` because speechSynthesis does
 * NOT expose its audio to the Web Audio API — so we can't FFT it. Those
 * boundary pulses are what animate the orb while JARVIS speaks.
 *
 * Phase 2 will introduce a Piper-backed TTS with the same public shape
 * (speak / cancel / setEnabled), but whose audio CAN be FFT-analysed, letting
 * us drop the boundary-pulse workaround.
 */
export function createTTS({
  rate,
  preferLang,
  onSpeakingStart,
  onSpeakingEnd,
  onBoundary,
  onVoicesLoaded,
}) {
  let voices = [];
  let chosenVoice = null;
  let enabled = true;

  const queue = [];
  let busy = false;

  function loadVoices() {
    voices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang.startsWith('es') || v.lang.startsWith('en'));
    const preferredIdx = voices.findIndex((v) => v.lang.startsWith(preferLang));
    if (preferredIdx >= 0) chosenVoice = voices[preferredIdx];
    else if (voices.length) chosenVoice = voices[0];
    const chosenIndex = preferredIdx >= 0 ? preferredIdx : 0;
    // Voices arrive asynchronously, so notify the UI whenever they (re)load.
    onVoicesLoaded?.({ voices, chosenIndex });
    return { voices, chosenIndex };
  }

  // Voices populate asynchronously in most browsers. The initial load is
  // deferred to a microtask so it never fires `onVoicesLoaded` while the
  // composition root is still wiring modules (the consumer that handles it may
  // not be initialized yet — would hit a temporal-dead-zone error otherwise).
  speechSynthesis.onvoiceschanged = loadVoices;
  queueMicrotask(loadVoices);

  function drain() {
    if (!queue.length) {
      busy = false;
      onSpeakingEnd?.();
      return;
    }
    busy = true;
    const sentence = queue.shift();
    const u = new SpeechSynthesisUtterance(sentence);
    if (chosenVoice) u.voice = chosenVoice;
    u.lang = chosenVoice ? chosenVoice.lang : 'es-ES';
    u.rate = rate;
    u.onstart = () => onSpeakingStart?.();
    u.onboundary = () => onBoundary?.();
    u.onend = () => drain();
    speechSynthesis.speak(u);
  }

  return {
    /** Queue a sentence to be spoken (no-op when disabled). */
    speak(sentence) {
      if (!enabled) return;
      const s = sentence.trim();
      if (!s) return;
      queue.push(s);
      if (!busy) drain();
    },

    /** List of usable voices and the currently chosen index. */
    getVoices() {
      return { voices, chosen: chosenVoice };
    },

    setVoice(index) {
      chosenVoice = voices[index] ?? chosenVoice;
    },

    setEnabled(value) {
      enabled = value;
      if (!value) {
        queue.length = 0;
        speechSynthesis.cancel();
      }
    },
  };
}
