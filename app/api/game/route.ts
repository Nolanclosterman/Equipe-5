import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { sanitizeInput } from '@/lib/sanitize';
import { searchWaste } from '@/lib/search';
import { chatCompletion } from '@/lib/claude';
import { classifyGameIntent } from '@/lib/intent';
import {
  newQuestion,
  questionText,
  checkTrueFalse,
  checkIntruder,
  explainAnswer,
  type GameQuestion,
} from '@/lib/game';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de messages ! Attends encore un peu. ⏳' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  let body: { action?: unknown; format?: unknown; question?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  // ── Démarrer une partie ────────────────────────────────────────────────
  if (body.action === 'start') {
    const format = typeof body.format === 'string' ? body.format : undefined;
    const question = newQuestion(format);
    return NextResponse.json({
      mode: 'game',
      question,
      reply: `🎮 C'est parti pour un défi tri ! Réponds quand tu es prêt, et dis "stop" quand tu veux arrêter.\n\n${questionText(
        question
      )}`,
    });
  }

  // ── Répondre pendant une partie ────────────────────────────────────────
  if (body.action === 'answer') {
    const question = body.question as GameQuestion | undefined;
    const rawMessage = typeof body.message === 'string' ? body.message : '';
    const { valid, sanitized } = sanitizeInput(rawMessage);

    if (!question || !valid || !sanitized) {
      return NextResponse.json(
        { mode: 'game', reply: 'Hmm, je n\'ai pas compris. Réessaie ! 😊', question },
        { status: 200 }
      );
    }

    const intent = await classifyGameIntent(sanitized);

    // L'enfant ne sait pas → on explique gentiment et on enchaîne (pas de pénalité)
    if (intent === 'dont_know') {
      const next = newQuestion('random');
      return NextResponse.json({
        mode: 'game',
        question: next,
        reply: `${explainAnswer(question)}\n\n---\nUne autre pour t'entraîner ! 👇\n\n${questionText(next)}`,
      });
    }

    // L'enfant veut un autre défi (sans quitter)
    if (intent === 'new_game') {
      const next = newQuestion('random');
      return NextResponse.json({
        mode: 'game',
        question: next,
        reply: `Pas de souci, on change ! 🔄\n\n${questionText(next)}`,
      });
    }

    // L'enfant veut arrêter
    if (intent === 'quit_game') {
      return NextResponse.json({
        mode: 'chat',
        question: null,
        reply: 'On arrête le jeu, bravo d\'avoir joué ! 🎉 Tu peux me reposer une question sur le tri quand tu veux. ♻️',
      });
    }

    // L'enfant pose une vraie question au lieu de répondre
    if (intent === 'ask_question') {
      const wasteResults = searchWaste(sanitized);
      const answer = await chatCompletion(sanitized, wasteResults, []);
      return NextResponse.json({
        mode: 'game',
        question, // on garde la même question
        reply: `${answer}\n\n---\nMaintenant, revenons à notre défi ! 👇\n\n${questionText(question)}`,
      });
    }

    // Sinon : c'est une réponse au défi → on corrige
    const result =
      question.format === 'truefalse'
        ? checkTrueFalse(question, sanitized)
        : checkIntruder(question, sanitized);

    const next = newQuestion('random');
    return NextResponse.json({
      mode: 'game',
      correct: result.correct,
      question: next,
      reply: `${result.reply}\n\n---\nQuestion suivante ! 👇\n\n${questionText(next)}`,
    });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
