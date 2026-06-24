/**
 * The "brain": a streaming client for Ollama's chat API plus conversation
 * history. Kept transport-agnostic on purpose — `chat()` is an async generator
 * that yields token chunks, so the UI layer owns presentation (sentence
 * splitting, speaking) and this module owns only the model conversation.
 *
 * Endpoint contract:
 *   POST {host}/api/chat
 *   body: { model, messages: [{role, content}], stream: true }
 *   response: NDJSON, one JSON object per line: { message: { content }, done }
 *
 * ── Phase 4 hook (orchestration) ────────────────────────────────────────────
 * The future plan is for the local model to ROUTE heavy work elsewhere instead
 * of doing it itself:
 *   - n8n via webhooks (automations / agents)
 *   - Claude Code for deep reasoning / heavy lifting
 * This is expected to use tool/function-calling: the model decides when to call
 * an external Tool. The seam is intentionally left open here via `registerTool`
 * + the `tools` registry below. NOT wired to anything yet — see TODO.
 */
export function createBrain({ host, systemPrompt }) {
  let baseHost = host.replace(/\/$/, '');
  let history = [{ role: 'system', content: systemPrompt }];

  // TODO(phase-4): each Tool will expose { name, description, schema, run() }.
  // When tool-calling is enabled we'll pass these to Ollama's `tools` field and
  // dispatch model-requested calls to n8n / Claude Code from here.
  const tools = new Map();

  return {
    setHost(next) {
      baseHost = next.replace(/\/$/, '');
    },

    /** Reset the conversation, keeping the system prompt. */
    reset() {
      history = [{ role: 'system', content: systemPrompt }];
    },

    /** True if the Ollama server responds to /api/tags. */
    async checkHealth() {
      try {
        const r = await fetch(`${baseHost}/api/tags`);
        return r.ok;
      } catch {
        return false;
      }
    },

    /** List installed models (name strings). Empty array on failure. */
    async listModels() {
      try {
        const r = await fetch(`${baseHost}/api/tags`);
        const data = await r.json();
        return (data.models || []).map((m) => m.name);
      } catch {
        return [];
      }
    },

    /**
     * Stream a chat completion. Pushes the user turn, yields content chunks as
     * they arrive, then records the full assistant turn in history.
     * Throws on transport/HTTP errors so the caller can show a status message.
     */
    async *chat(model, text) {
      history.push({ role: 'user', content: text });

      const res = await fetch(`${baseHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: history, stream: true }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let reply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop(); // keep the trailing partial line for the next chunk
        for (const line of lines) {
          if (!line.trim()) continue;
          const j = JSON.parse(line);
          const chunk = j.message?.content;
          if (chunk) {
            reply += chunk;
            yield chunk;
          }
        }
      }

      history.push({ role: 'assistant', content: reply });
    },

    // ── Phase 4 seam (unused for now) ──────────────────────────────────────
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  };
}
