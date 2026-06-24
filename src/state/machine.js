/**
 * Central state machine.
 *
 * In the original prototype `setState` mutated the DOM directly, so the orb,
 * the HUD and the audio layer were all tangled together. Here the machine is a
 * tiny pub/sub: it owns the current state and notifies subscribers on change.
 * The orb, UI and audio modules each subscribe independently — no module talks
 * to another. This decoupling is also what makes the Phase 4 orchestrator easy
 * to slot in later.
 */

export const State = Object.freeze({
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
});

export function createStateMachine() {
  let current = State.IDLE;
  const listeners = new Set();

  return {
    get current() {
      return current;
    },

    /** Transition to a new state and notify subscribers (no-op if unchanged). */
    set(next) {
      if (next === current) return;
      current = next;
      for (const fn of listeners) fn(next);
    },

    /** Subscribe to state changes. Returns an unsubscribe function. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
