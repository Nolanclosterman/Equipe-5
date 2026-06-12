const WINDOW_MS = 10_000;
const ipTimestamps = new Map<string, number>();

function cleanup() {
  const now = Date.now();
  for (const [ip, ts] of ipTimestamps) {
    if (now - ts > 60_000) ipTimestamps.delete(ip);
  }
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  cleanup();
  const now = Date.now();
  const last = ipTimestamps.get(ip);

  if (last !== undefined) {
    const elapsed = now - last;
    if (elapsed < WINDOW_MS) {
      return { allowed: false, retryAfter: Math.ceil((WINDOW_MS - elapsed) / 1000) };
    }
  }

  ipTimestamps.set(ip, now);
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
}
