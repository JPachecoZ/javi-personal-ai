/**
 * Speech-to-text via the browser's webkitSpeechRecognition (Chrome/Chromium).
 *
 * Runs in `continuous` mode for hands-free listening: it keeps transcribing and
 * emits each finished phrase via `onFinal`, while `onInterim` streams the
 * partial text live. The browser still ends sessions on its own (silence,
 * timeouts), so `onEnd` lets the caller decide whether to restart — `main.js`
 * restarts while the user is in listening mode and pauses during a reply.
 *
 * Privacy caveat: this streams audio to Google. Phase 3 swaps it for a local
 * whisper.cpp microservice. Returns `null` when the API is unavailable.
 */
export function createSTT({ lang, onStart, onInterim, onFinal, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const recog = new SR();
  recog.lang = lang;
  recog.interimResults = true;
  recog.continuous = true;

  let recording = false;

  recog.onstart = () => {
    recording = true;
    onStart?.();
  };

  recog.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim.trim()) onInterim?.(interim.trim());
    if (final.trim()) onFinal?.(final.trim());
  };

  recog.onerror = (e) => {
    console.warn('STT error', e.error);
    onError?.(e.error);
  };

  recog.onend = () => {
    recording = false;
    onEnd?.();
  };

  return {
    get recording() {
      return recording;
    },
    start() {
      try {
        recog.start();
      } catch {
        // start() throws if already started — safe to ignore.
      }
    },
    stop() {
      try {
        recog.stop();
      } catch {
        // ignore
      }
    },
  };
}
