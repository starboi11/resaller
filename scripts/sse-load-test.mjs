const url = process.env.SSE_LOAD_URL;
const cookie = process.env.SSE_SESSION_COOKIE;
const clients = Number(process.env.SSE_CLIENTS ?? 50);
const durationMs = Number(process.env.SSE_DURATION_MS ?? 15_000);

if (!url || !cookie) {
  console.error('SSE_LOAD_URL and SSE_SESSION_COOKIE are required.');
  process.exit(2);
}
if (!Number.isInteger(clients) || clients < 1 || clients > 500) {
  console.error('SSE_CLIENTS must be between 1 and 500.');
  process.exit(2);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), durationMs);
const startedAt = Date.now();
let connected = 0;
let bytes = 0;

await Promise.all(
  Array.from({ length: clients }, async () => {
    try {
      const response = await fetch(url, {
        headers: { accept: 'text/event-stream', cookie },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE returned ${response.status}`);
      connected += 1;
      const reader = response.body.getReader();
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.byteLength;
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  }),
).finally(() => clearTimeout(timer));

console.log(JSON.stringify({ clients, connected, bytes, durationMs: Date.now() - startedAt }));
if (connected !== clients) process.exit(1);
