/**
 * Microphone amplitude meter via the Web Audio API.
 *
 * Opens the mic, runs an AnalyserNode FFT and reports a smoothed 0..1 level
 * through `onLevel`. This drives the orb while the USER is talking.
 *
 * Phase 2 note: this same AnalyserNode pattern will be reused to tap Piper's
 * playback audio so the orb reacts with real FFT while Javi speaks too.
 */
export function createMicMeter({ onLevel }) {
  let audioCtx = null;
  let stream = null;
  let raf = 0;

  async function start() {
    if (stream) return; // already running — recognition auto-restarts call this repeatedly
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (const v of data) sum += v;
        // 110 is an empirical divisor that maps typical speech energy to ~0..1.
        onLevel(Math.min(1, sum / data.length / 110));
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      console.warn('mic meter unavailable', e);
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    onLevel(0);
  }

  return { start, stop };
}
