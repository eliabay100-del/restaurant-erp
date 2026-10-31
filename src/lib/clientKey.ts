// Client-safe idempotency key. crypto.randomUUID only exists in secure
// contexts; LAN devices on plain HTTP get a timestamp+random fallback.
export function newClientKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
