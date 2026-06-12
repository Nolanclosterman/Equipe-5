// Cost / abuse guard for the LLM-bound routes.
//
// Two layers:
//  1. Per-IP sliding-window throttle (default 5 requests / 10s; the image
//     route uses a longer window since vision is the costliest call).
//  2. A global per-instance ceiling on total allowed LLM calls per rolling
//     minute. This is the real cost backstop: even if a caller shards requests
//     across many spoofed IP values, total spend stays bounded. It is per
//     serverless instance (in-memory), so the effective cap scales with the
//     number of warm instances — a bounded ceiling, not a perfect global one,
//     but far better than the previous unbounded exposure. Tune via
//     MAX_LLM_CALLS_PER_MIN.

const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_MAX_PER_WINDOW = 5;
const GLOBAL_WINDOW_MS = 60_000;
const GLOBAL_MAX = Math.max(1, Number(process.env.MAX_LLM_CALLS_PER_MIN ?? 60));

const ipTimestamps = new Map<string, number[]>();
let globalHits: number[] = [];

function cleanup(now: number) {
  for (const [ip, timestamps] of ipTimestamps) {
    const fresh = timestamps.filter((t) => now - t < DEFAULT_WINDOW_MS * 6);
    if (fresh.length === 0) ipTimestamps.delete(ip);
    else ipTimestamps.set(ip, fresh);
  }
}

export function checkRateLimit(
  ip: string,
  windowMs: number = DEFAULT_WINDOW_MS,
  maxPerWindow: number = DEFAULT_MAX_PER_WINDOW
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  cleanup(now);

  // Layer 1 — per-IP sliding window.
  const recent = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= maxPerWindow) {
    const oldest = recent[0];
    return { allowed: false, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }

  // Layer 2 — global per-instance ceiling.
  globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (globalHits.length >= GLOBAL_MAX) {
    const oldest = globalHits[0];
    return {
      allowed: false,
      retryAfter: Math.ceil((GLOBAL_WINDOW_MS - (now - oldest)) / 1000),
    };
  }

  // Passed both layers — record the call.
  recent.push(now);
  ipTimestamps.set(ip, recent);
  globalHits.push(now);
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Prefer platform-set headers that a client cannot forge past the edge proxy.
  // Vercel populates x-real-ip / x-vercel-forwarded-for with the true peer IP.
  // Raw x-forwarded-for is client-appendable — its left-most value is attacker
  // controlled — so it is only a last-resort fallback (e.g. local dev).
  const trusted = headers.get('x-real-ip') ?? headers.get('x-vercel-forwarded-for');
  if (trusted) return trusted.split(',')[0].trim();

  const forwarded = headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
}
