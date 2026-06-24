/**
 * Composition root.
 *
 * The only file that knows about every module. It instantiates them, wires
 * their callbacks together, and owns two pieces of orchestration:
 *   1. Hands-free listening: the mic / "Escuchando" segment toggle a persistent
 *      listening mode. Each final transcript is sent; listening pauses while
 *      Javi thinks/speaks and resumes afterwards.
 *   2. Streaming a reply from the brain while speaking it sentence-by-sentence,
 *      and surfacing the live text in the center caption.
 */
import './ui/styles.css';
import { config } from '../config.js';
import { createStateMachine, State } from './state/machine.js';
import { createThemes } from './ui/themes.js';
import { STATE_UI } from './ui/state-presentation.js';
import { createOrb } from './orb/orb.js';
import { createMicMeter } from './audio/mic-meter.js';
import { createSTT } from './audio/stt.js';
import { createTTS } from './audio/tts.js';
import { createBrain } from './brain/ollama.js';
import { createHUD } from './ui/hud.js';
import { createControls } from './ui/controls.js';

const $ = (id) => document.getElementById(id);

/* ── core ─────────────────────────────────────────────────────────────────── */
const stateMachine = createStateMachine();

const themes = createThemes($('swatches'), { defaultKey: config.ui.defaultTheme });

const orb = createOrb($('orb'), stateMachine);

const hud = createHUD({
  statusDot: $('statusDot'),
  stateLabel: $('stateLabel'),
  caption: $('caption'),
});

const brain = createBrain({
  host: config.ollama.host,
  systemPrompt: config.systemPrompt,
});

let selectedModel = config.ollama.defaultModel;
let offline = false;
let voiceMode = false;
let streaming = false;

/* ── audio ────────────────────────────────────────────────────────────────── */
const micMeter = createMicMeter({ onLevel: (v) => orb.setAmplitudeTarget(v) });

const tts = createTTS({
  rate: config.tts.rate,
  preferLang: config.tts.preferLang,
  onSpeakingStart: () => stateMachine.set(State.SPEAKING),
  onBoundary: () => orb.pulse(),
  onSpeakingEnd: () => {
    orb.setAmplitudeTarget(0);
    if (stateMachine.current === State.SPEAKING) afterResponse();
  },
});

const stt = createSTT({
  lang: config.stt.lang,
  // Only open the FFT mic stream if explicitly enabled — by default we let
  // recognition own the mic to avoid the device contention that leaves it deaf.
  onStart: () => {
    if (config.features.micFftWhileListening) micMeter.start();
  },
  onInterim: (txt) => {
    if (stateMachine.current === State.LISTENING) {
      hud.setCaption(txt);
      orb.pulse(); // animate the orb from speech results instead of mic FFT
    }
  },
  onFinal: (txt) => {
    if (txt) send(txt);
  },
  onEnd: () => {
    // The browser ended the session; keep listening if we still want to.
    if (voiceMode && stateMachine.current === State.LISTENING) stt.start();
  },
  onError: (err) => handleSttError(err),
});

/* ── UI ───────────────────────────────────────────────────────────────────── */
const controls = createControls(
  {
    segmented: $('segmented'),
    micBtn: $('micBtn'),
    input: $('input'),
    sendBtn: $('sendBtn'),
    dock: $('dock'),
    revealBtn: $('revealBtn'),
  },
  {
    sttAvailable: !!stt,
    states: [
      { key: State.LISTENING, label: STATE_UI[State.LISTENING].label, actionable: true },
      { key: State.THINKING, label: STATE_UI[State.THINKING].label, actionable: false },
      { key: State.SPEAKING, label: STATE_UI[State.SPEAKING].label, actionable: false },
      { key: State.IDLE, label: STATE_UI[State.IDLE].label, actionable: true },
    ],
    onSegment: (key) => {
      if (key === State.LISTENING) startListening();
      else if (key === State.IDLE) stopListening();
    },
    onMicToggle: () => (voiceMode ? stopListening() : startListening()),
    onSend: (text) => send(text),
    onInput: (value) => controls.setSendActive(!!value.trim()),
  }
);

// Keep the header label + active segment in sync with the real state.
stateMachine.subscribe((state) => {
  if (!offline) hud.setStateLabel(STATE_UI[state].label);
  controls.setActiveSegment(state);
});

/* ── listening (hands-free) ───────────────────────────────────────────────── */
function startListening() {
  if (!stt) return;
  voiceMode = true;
  controls.setMicActive(true);
  stateMachine.set(State.LISTENING);
  hud.setCaption(STATE_UI[State.LISTENING].caption);
  stt.start(); // micMeter is started from stt.onStart
}

/** Surface STT failures so the user knows *why* listening didn't work. */
function handleSttError(err) {
  const fatal = {
    'not-allowed': 'Necesito permiso para usar el micrófono (revisa el candado de la barra).',
    'service-not-allowed': 'Necesito permiso para usar el micrófono.',
    'audio-capture': 'No encuentro un micrófono conectado.',
    network: 'El reconocimiento de voz del navegador necesita internet (usa Google).',
  };
  if (err in fatal) {
    hud.setCaption(fatal[err]);
    stopListening();
  }
  // 'no-speech' / 'aborted' are transient — onEnd will restart the session.
}

function stopListening() {
  voiceMode = false;
  controls.setMicActive(false);
  stt?.stop();
  micMeter.stop();
  stateMachine.set(State.IDLE);
  hud.setCaption(STATE_UI[State.IDLE].caption);
}

/** Called once a reply finishes (spoken or silent): resume listening or idle. */
function afterResponse() {
  streaming = false;
  if (voiceMode) startListening();
  else {
    stateMachine.set(State.IDLE);
    hud.setCaption(STATE_UI[State.IDLE].caption);
  }
}

/* ── orchestration: stream a reply, speak it sentence-by-sentence ───────────── */
async function send(text) {
  text = (text || '').trim();
  if (!text) return;

  controls.clearInput();
  controls.setSendActive(false);
  stt?.stop(); // pause listening while we process
  micMeter.stop();

  streaming = true;
  stateMachine.set(State.THINKING);
  hud.setCaption(STATE_UI[State.THINKING].caption);
  orb.setAmplitudeTarget(0.3);

  let reply = '';
  let spokenUpTo = 0;
  let spoke = false;

  const maybeSpeak = (sentence) => {
    const s = sentence?.trim();
    if (s) {
      tts.speak(s);
      spoke = true;
    }
  };

  try {
    for await (const chunk of brain.chat(selectedModel, text)) {
      reply += chunk;
      hud.setCaption(reply); // live stream in the caption

      const m = reply.slice(spokenUpTo).match(/[^.!?…]+[.!?…]+/);
      if (m) {
        const sentence = m[0];
        spokenUpTo += m.index + sentence.length;
        maybeSpeak(sentence);
      }
    }
    maybeSpeak(reply.slice(spokenUpTo));

    // If nothing was queued to speak, TTS callbacks won't fire — finish here.
    if (!spoke) afterResponse();
  } catch (e) {
    console.error(e);
    streaming = false;
    hud.setDot('error');
    hud.setStateLabel('Sin conexión');
    hud.setCaption('No puedo conectar con el modelo. ¿Está corriendo Ollama?');
    stateMachine.set(State.IDLE);
  }
}

/* ── connection health ────────────────────────────────────────────────────── */
async function refreshHealth() {
  const ok = await brain.checkHealth();
  offline = !ok;
  if (ok) {
    hud.setDot('normal');
    hud.setStateLabel(STATE_UI[stateMachine.current].label);
  } else {
    hud.setDot('error');
    hud.setStateLabel('Sin conexión');
  }
  return ok;
}

/* ── boot ─────────────────────────────────────────────────────────────────── */
themes.init();
orb.start();
hud.setCaption(STATE_UI[State.IDLE].caption);

(async () => {
  if (await refreshHealth()) {
    const models = await brain.listModels();
    if (models.length) {
      selectedModel = models.includes(config.ollama.defaultModel)
        ? config.ollama.defaultModel
        : models.find((m) => m.includes('gemma')) || models[0];
    }
  }
  setInterval(refreshHealth, 15000);
})();
