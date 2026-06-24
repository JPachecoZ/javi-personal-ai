import { describe, it, expect, vi } from 'vitest';
import { createStateMachine, State } from './machine.js';

describe('state machine', () => {
  it('starts idle', () => {
    expect(createStateMachine().current).toBe(State.IDLE);
  });

  it('transitions and exposes the new state', () => {
    const m = createStateMachine();
    m.set(State.LISTENING);
    expect(m.current).toBe(State.LISTENING);
  });

  it('notifies subscribers on change', () => {
    const m = createStateMachine();
    const spy = vi.fn();
    m.subscribe(spy);
    m.set(State.THINKING);
    expect(spy).toHaveBeenCalledWith(State.THINKING);
  });

  it('does not notify when the state is unchanged', () => {
    const m = createStateMachine();
    const spy = vi.fn();
    m.subscribe(spy);
    m.set(State.IDLE); // already idle
    expect(spy).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const m = createStateMachine();
    const spy = vi.fn();
    const off = m.subscribe(spy);
    off();
    m.set(State.SPEAKING);
    expect(spy).not.toHaveBeenCalled();
  });
});
