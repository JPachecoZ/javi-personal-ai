/**
 * Central configuration for Javi.
 *
 * Everything a user might want to tweak (Ollama host, model, default theme,
 * voice, the system prompt, feature flags) lives here. The new UI dropped the
 * on-screen settings panel, so model/voice/host are configured here and the app
 * auto-detects sensible defaults at boot.
 */
export const config = {
  appName: 'Javi',

  ollama: {
    host: 'http://localhost:11434',
    // Preferred model if present in `GET /api/tags`; otherwise the first model
    // whose name includes "gemma", then whatever is available.
    defaultModel: 'gemma3:12b',
  },

  ui: {
    // One of the keys in src/ui/themes.js (coral | salvia | terra | noche).
    // Overridden by the user's last choice (persisted in localStorage).
    defaultTheme: 'coral',
  },

  stt: {
    // BCP-47 locale for webkitSpeechRecognition. es-PE = Spanish (Peru).
    lang: 'es-PE',
  },

  tts: {
    rate: 1.04,
    // Voice picker prefers a voice whose lang starts with this prefix.
    preferLang: 'es',
  },

  // Voice-tuned prompt: short, spoken-style answers, no markdown/lists.
  systemPrompt:
    'Eres Javi, un asistente personal local. Respondes en el idioma del usuario (español o inglés). ' +
    'Eres conciso, cálido y directo: respuestas para ser escuchadas en voz alta, no leídas, así que evita listas largas, ' +
    'markdown y símbolos. Frases cortas y naturales. Si no sabes algo con certeza, dilo. ' +
    'Vives en la máquina del usuario en Lima, Perú.',

  // Feature flags.
  features: {
    usePiper: false, // Phase 2: local high-quality TTS microservice
    useWhisper: false, // Phase 3: local private STT microservice

    // Live mic FFT for the orb while listening opens a 2nd getUserMedia stream,
    // which can starve webkitSpeechRecognition of audio (silent no-result,
    // common on Linux/PulseAudio). Off by default → recognition gets the mic to
    // itself; the orb reacts via speech-result pulses instead. Flip to true to
    // test the contention theory. Phase 2's Piper FFT is the real reactive win.
    micFftWhileListening: false,
  },
};
