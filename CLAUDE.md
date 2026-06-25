# Javi — Local Voice AI Orchestrator

> Nota: el proyecto se llamaba "JARVIS" y se renombró a **Javi** (carpeta `javi/`).
> El prototipo original de un solo archivo se conserva en `legacy/jarvis.html`.

## Qué es este proyecto

Una interfaz de voz tipo asistente (inspirada en Jarvis de Iron Man), llamada **Javi**,
para un asistente de IA que corre **100% local** en mi máquina. La etapa actual es la **cara + voz**: un frontend propio
con un orbe de luces reactivas, entrada por texto y voz, y respuesta hablada, conectado
a un modelo local vía Ollama.

La visión a futuro (NO implementar todavía, solo tenerla en mente para no cerrar puertas):
este asistente será un **orquestador**. El modelo local NO hará research ni trabajo pesado
por su cuenta — debe delegar:
- Trabajo pesado / razonamiento profundo → **Claude Code** (vía su API o invocación).
- Automatizaciones y agentes → **n8n** (vía webhooks).
El modelo local es el "cerebro coordinador" conversacional: decide, enruta y mantiene
el contexto, pero terceriza lo complejo.

## Mi hardware (importante para decisiones técnicas)

- GPU: AMD Radeon RX 9070 XT, 16GB VRAM, RDNA4 (gfx1201)
- CPU: AMD Ryzen 5 2600 (6c/12t, Zen+, antiguo)
- RAM: 32GB
- OS: Ubuntu Linux
- Stack de IA: Ollama corriendo en Docker (imagen `ollama/ollama:rocm`) en el puerto 11434
- Modelo principal actual: `gemma3:12b` (cabe entero en VRAM, rápido, buen español)

**Restricción clave:** los modelos deben caber completos en 16GB de VRAM. Si se desbordan
a RAM, el Ryzen 2600 los arrastra y la velocidad colapsa (~14x más lento). No sugerir
modelos densos de 24B+ como driver principal.

## Estado actual (lo que YA funciona)

Hay un prototipo de un solo archivo HTML (`jarvis.html`) que ya hace:
- Orbe en `<canvas>`: anillos concéntricos rotando, núcleo que respira, campo de partículas.
  Máquina de estados visual: reposo / escuchando / procesando / respondiendo.
- Reactividad del orbe:
  - Cuando el USUARIO habla → FFT real del micrófono vía Web Audio API `AnalyserNode`.
  - Cuando Javi habla → pulsos por palabra vía eventos `boundary` de `speechSynthesis`
    (NOTA: `speechSynthesis` no expone su audio al Web Audio API, por eso se usan boundary
    events en vez de FFT real al hablar. Esto es una limitación conocida del navegador.)
- STT (voz → texto): `webkitSpeechRecognition`, locale `es-PE`. Solo Chrome/Chromium.
- TTS (texto → voz): `speechSynthesis` del navegador, prioriza voz en español.
- Habla por frases mientras el modelo genera (baja latencia percibida).
- Conexión a Ollama: `POST /api/chat` con `stream: true`, mantiene historial.
- Autodetección de modelos vía `GET /api/tags`.
- System prompt afinado para voz (respuestas cortas, sin markdown ni listas).

Voy a importar ese `jarvis.html` a este proyecto como punto de partida (lo pego en /legacy
o te lo doy). Tómalo como referencia funcional, no como arquitectura final.

## Lo que quiero que hagas, Claude Code

### Fase 1 — Reestructurar el prototipo en un proyecto mantenible
Convertir el HTML monolítico en una estructura limpia. Propuesta (ajústala con criterio):

```
jarvis/
├── index.html
├── src/
│   ├── orb/            # render del orbe (canvas), estados, reactividad
│   ├── audio/          # STT (speech recognition) + TTS (speech synthesis) + mic meter
│   ├── brain/          # cliente Ollama (streaming, historial, system prompt)
│   ├── state/          # máquina de estados central (idle/listening/thinking/speaking)
│   └── ui/             # HUD, controles, settings
├── config.js           # host de Ollama, modelo, voz, prompt — configurable
└── README.md
```

Stack: vanilla JS + Vite (ligero, sin framework pesado por ahora). Si crees que conviene
un framework, justifícalo, pero prioriza simplicidad y que arranque rápido.

### Fase 2 — Mejorar la voz (el salto de calidad más importante)
La voz del navegador suena robótica en Linux. Quiero migrar a TTS local de calidad:
- Integrar **Piper** (https://github.com/rhasspy/piper) como microservicio local
  (corre el modelo de voz, expone un endpoint, devuelve audio WAV). Voz en español.
- Como el audio de Piper SÍ es capturable por Web Audio API, conectar ese audio a un
  `AnalyserNode` para que el orbe haga **FFT real también cuando Javi habla** (no solo
  boundary events). Ese es el detalle que hará que se sienta vivo de verdad.
- Dejar `speechSynthesis` como fallback si Piper no está corriendo.

### Fase 3 — STT local de verdad (privacidad)
`webkitSpeechRecognition` manda audio a Google. Migrar a **whisper.cpp**
(https://github.com/ggerganov/whisper.cpp) como microservicio local para transcripción
100% privada. Mantener el de navegador como fallback.

### Fase 4 — Capa de orquestación (diseñar, no implementar aún)
Dejar el cliente del cerebro (`src/brain/`) preparado para que en el futuro el modelo local
pueda enrutar a:
- **n8n** vía webhooks (automatizaciones/agentes).
- **Claude Code** para trabajo pesado.
Esto probablemente se haga con tool-calling / function-calling: el modelo decide cuándo
llamar a una herramienta externa. Por ahora solo deja la abstracción lista (una interfaz
`Tool` o similar) y un TODO claro. NO conectar n8n ni Claude Code todavía.

## Detalles técnicos a respetar

- **CORS de Ollama:** el contenedor se arranca con `OLLAMA_ORIGINS="*"` para que el
  navegador pueda llamarlo. Documéntalo en el README.
- **Origen seguro para el micrófono:** servir vía `localhost` (no `file://`). Con Vite
  el dev server ya cumple esto.
- **Mantener todo local-first:** nada de servicios en la nube salvo, en el futuro, la
  delegación explícita a Claude Code. Documentar claramente cualquier punto donde algo
  salga a internet.
- **Endpoint de Ollama usado:** `POST http://localhost:11434/api/chat`
  body: `{ model, messages: [{role, content}], stream: true }`
  Respuesta: NDJSON, cada línea `{ message: { content }, done }`.

## Cómo correr (estado actual, para que lo verifiques)

```bash
# Ollama con CORS abierto y modelo siempre cargado
docker rm -f ollama
docker run -d --device /dev/kfd --device /dev/dri \
  -v ollama:/root/.ollama -p 11434:11434 \
  -e OLLAMA_ORIGINS="*" \
  -e OLLAMA_KEEP_ALIVE=-1 \
  --name ollama ollama/ollama:rocm

# servir el frontend (origen seguro para el micrófono)
python3 -m http.server 8080   # o el dev server de Vite
# abrir http://localhost:8080 en Chrome
```

## Prioridades

1. Que la reestructuración no rompa nada de lo que ya funciona.
2. Fase 2 (Piper + FFT real al hablar) es la que más impacto tiene en el "feel". Priorízala.
3. Código legible y comentado en español o inglés (me da igual), porque estoy aprendiendo
   y quiero entender lo que haces.
4. Explícame las decisiones de arquitectura conforme avanzas.

## Notas sobre mí

Soy desarrollador (Angular, Node), así que puedes tirarme código y detalles técnicos sin
filtro. Estoy aprendiendo el lado de IA local, así que cuando tomes una decisión de ese
dominio (modelos, cuantización, voz), explícame el porqué brevemente.
