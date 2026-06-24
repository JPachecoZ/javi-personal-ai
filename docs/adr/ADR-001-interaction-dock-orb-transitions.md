# ADR-001 (Javi): Dock de interacción colapsable y transiciones suaves del orbe

## Status
Approved — 2026-06-24

## Context
Dos cambios de interacción sobre la app existente (US-001, US-002). La base ya
está decidida (vanilla JS + Vite, orbe de partículas DOM, máquina de estados
pub/sub). El dueño pide explícitamente **no introducir dependencias** y mantener
todo **local**.

## Requirements
### Functional
- **US-001:** dock colapsado por defecto (solo micrófono + flecha); expandir /
  colapsar barra de texto y estados con animación slide.
- **US-002:** las partículas se desplazan suavemente a la nueva forma al cambiar
  de estado, conservando rotación y "vibe".

### Non-Functional
- **Sin dependencias de runtime** — solo JS + CSS nativos. *(Principio rector.)*
- Local-first: ninguna de las dos features toca la red.
- 60 fps objetivo → animar solo `transform` / `opacity` (compositor, no layout).
- Respetar `prefers-reduced-motion`.
- **No contaminar la máquina de estados conversacional** con estado de UI (chrome).

## Decision

### US-001 — Dock colapsable
- La visibilidad del dock es **estado de vista local** (booleano `expanded`),
  vive en la capa UI / `controls.js`, **no** en `src/state/machine.js` (esa
  máquina modela el estado conversacional de Javi, no el chrome).
- Markup: micrófono persistente + flecha siempre visibles; el dock
  (segmented + barra) envuelto en un contenedor que se desliza con
  `transform: translateY(100%) ↔ 0` + `opacity`, `transition ~280ms ease`.
  Toggle por clase.
- El micro persistente es el único control de voz; la barra expandida queda
  **texto + enviar**.
- `prefers-reduced-motion` → transición instantánea.

### US-002 — Morphing del orbe: pool fijo + transform con CSS transition
- Construir el pool de partículas **una sola vez**: `N = 44` (máximo entre
  formas). **Nunca** se reconstruye el DOM al cambiar de estado (esa
  reconstrucción es la causa del salto actual).
- Estructura por partícula (separa responsabilidades para que no choquen los
  `transform`):
  - **wrapper externo** → posición y tamaño vía `transform: translate(x,y) scale(s)`;
    *esto* es lo que morphea, con `transition: transform 600ms ease, opacity 300ms`.
  - **elemento interno** → la animación `vibe` (wobble) + el glow.
- El timing de `vibe` (dur/delay) se asigna **una vez por índice** del pool →
  estable, no se reinicia en cada morph.
- Al cambiar de estado: `makeParticles(shape)` da solo las posiciones objetivo;
  a la partícula `i` se le asigna su target `(x,y,s)`; los índices sobrantes para
  esa forma → `opacity:0` (se colapsan / desvanecen). Solo cambian estilos inline
  → la CSS transition anima el morph.
- **Rotación:** una sola velocidad continua siempre activa para todos los estados
  (incluido `scatter`). Evita el salto de reiniciar `animation-duration` y
  conserva el giro.
- La reactividad de amplitud (`--orb-energy`, loop rAF) no cambia.
- `prefers-reduced-motion` → morph corto o instantáneo.

## Deployment
Sin cambios: mismo dev/build de Vite, 100% cliente.

## Alternatives Considered
- **(b) Tween por rAF en JS:** reimplementa a mano lo que la CSS transition da
  gratis. Más código y superficie de bug. Rechazado.
- **(c) Transition sobre `left/top`:** dispara layout/paint por frame en 44 nodos;
  `transform` es solo compositor. Rechazado.
- **Librerías de animación (GSAP, anime.js, Motion One):** violan el principio de
  cero dependencias. Rechazadas.
- **Velocidades de rotación por estado con crossfade:** complejo, beneficio
  marginal. Rechazado a favor de una sola velocidad.
- **Visibilidad del dock en la máquina de estados central:** mezcla chrome con
  estado conversacional. Rechazado.

## Consequences
- Refactor del módulo orbe: de "reconstruir innerHTML por estado" a "construir el
  pool una vez y re-targetear estilos". Más performante y habilita el morph; algo
  más de código. Se reutiliza `makeParticles` / `rng` tal cual (solo posiciones).
- La identidad de partícula es posicional (índice i→i), no semántica; trayectorias
  del morph arbitrarias pero visualmente agradables. Aceptable.
- Se pierde la velocidad de rotación por estado (cambio estético menor, aprobado).
- Ambas features quedan dependency-free, locales y conscientes de `reduced-motion`.

## Implementation notes (handoff a Dev)
- US-001 y US-002 son independientes; orden sugerido: US-001 → US-002.
- US-001: toca `index.html`, `src/ui/controls.js`, `src/ui/styles.css`.
- US-002: refactor principal en `src/orb/orb.js` (+ `styles.css`). Sin tocar la
  máquina de estados ni el cliente Ollama.
- Workflow: review del Lead por story, commit por story.
