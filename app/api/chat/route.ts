import { NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/sanitize';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { searchWaste } from '@/lib/search';
import { chatCompletion } from '@/lib/claude';
import { logUnknownTerm, logQuestionPattern } from '@/lib/db';
import type { Message } from '@/lib/claude';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de messages ! Attends encore un peu. ⏳' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const rawMessage = typeof body.message === 'string' ? body.message : '';
  const { valid, sanitized } = sanitizeInput(rawMessage);

  if (!valid || !sanitized) {
    return NextResponse.json(
      {
        reply:
          "Hmm, ce message ne me semble pas correct. 🤔 Tu peux me poser une question sur le tri des déchets !",
      },
      { status: 200 }
    );
  }

  // History is client-supplied and therefore untrusted (a caller can forge a
  // prior "assistant" turn). Run every turn through the same sanitizer as the
  // live message and drop any turn carrying an injection pattern or junk.
  const history: Message[] = Array.isArray(body.history)
    ? (body.history as Message[])
        .filter(
          (m) =>
            m &&
            typeof m === 'object' &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
        .map((m) => {
          const { valid, sanitized } = sanitizeInput(m.content);
          return valid && sanitized ? { role: m.role, content: sanitized } : null;
        })
        .filter((m): m is Message => m !== null)
    : [];

  const wasteResults = searchWaste(sanitized);

  if (wasteResults.length === 0) {
    const trimmed = sanitized.trim().toLowerCase().slice(0, 60);
    logUnknownTerm(trimmed);
  }

  const firstWords = sanitized.trim().split(/\s+/).slice(0, 4).join(' ').toLowerCase();
  logQuestionPattern(firstWords);

  try {
    const reply = await chatCompletion(sanitized, wasteResults, history);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[chat] Claude API error:', error);
    return NextResponse.json(
      { error: "Oups, je n'arrive pas à répondre là. 😅 Réessaie dans quelques secondes !" },
      { status: 503 }
    );
  }
}
