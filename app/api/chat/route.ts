import { NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/sanitize';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { searchWaste } from '@/lib/search';
import { streamChatCompletion } from '@/lib/claude';
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
    // Signal the client that this was a blocked injection attempt so it can
    // power the "Vrai déchet ou Triche ?" easter egg (counter lives client-side).
    return NextResponse.json(
      {
        reply:
          "Hmm, ce message ne me semble pas correct. 🤔 Tu peux me poser une question sur le tri des déchets !",
        injection: true,
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

  // Stream the reply as UTF-8 text deltas. Pre-stream failures above still return
  // JSON with proper status codes; once we start streaming the status is committed
  // to 200, so a mid-stream Claude error degrades to a friendly in-band fallback.
  const FALLBACK =
    "Oups, je n'arrive pas à répondre là. 😅 Réessaie dans quelques secondes !";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let sentAnything = false;
      try {
        for await (const chunk of streamChatCompletion(sanitized, wasteResults, history)) {
          sentAnything = true;
          controller.enqueue(encoder.encode(chunk));
        }
        // Empty/refused completion → never leave the child with a blank bubble.
        if (!sentAnything) {
          controller.enqueue(
            encoder.encode(
              "Hmm, je n'ai pas trouvé quoi répondre. 🤔 Tu peux reformuler ta question sur le tri ?"
            )
          );
        }
      } catch (error) {
        console.error('[chat] Claude stream error:', error);
        if (!sentAnything) controller.enqueue(encoder.encode(FALLBACK));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
