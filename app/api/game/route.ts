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
  parseDifficulty,
  type GameQuestion,
  type Difficulty,
} from '@/lib/game';

function readDifficulty(value: unknown): Difficulty | undefined {
  return value === 'expert' || value === 'debutant' ? value : undefined;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de messages ! Attends encore un peu. ⏳' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  let body: {
    action?: unknown;
    format?: unknown;
    question?: unknown;
    message?: unknown;
    difficulty?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  // ── Démarrer une partie ────────────────────────────────────────────────
  if (body.action === 'start') {
    const format = typeof body.format === 'string' ? body.format : undefined;
    const difficulty: Difficulty =
      readDifficulty(body.difficulty) ??
      parseDifficulty(typeof body.message === 'string' ? body.message : '');
    const question = newQuestion(format, difficulty);
    const niveau = difficulty === 'expert' ? '🔴 Niveau Expert' : '🟢 Niveau Débutant';
    return NextResponse.json({
      mode: 'game',
      difficulty,
      question,
      reply: `${niveau}, c'est parti ! 🎮 Réponds quand tu es prêt, et dis "stop" pour arrêter.\n\n${questionText(
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

    const difficulty = readDifficulty(body.difficulty);
    const context =
      question.format === 'truefalse'
        ? `C'est un Vrai/Faux : la seule réponse valide est "vrai" ou "faux".`
        : `C'est un jeu d'intrus : la seule réponse valide est un numéro (1 à ${question.items.length}) ou le nom d'un de ces objets : ${question.items
            .map((i) => i.dechet)
            .join(', ')}.`;
    const intent = await classifyGameIntent(sanitized, context);

    // L'enfant ne sait pas → on explique gentiment et on enchaîne (pas de pénalité)
    if (intent === 'dont_know') {
      const next = newQuestion('random', difficulty);
      return NextResponse.json({
        mode: 'game',
        question: next,
        reply: `${explainAnswer(question)}\n\n---\nUne autre pour t'entraîner ! 👇\n\n${questionText(next)}`,
      });
    }

    // L'enfant veut changer de jeu → on bascule vers l'AUTRE format (pas une question au hasard)
    if (intent === 'new_game') {
      const otherFormat = question.format === 'truefalse' ? 'intruder' : 'truefalse';
      const nom = otherFormat === 'truefalse' ? 'Vrai ou Faux ✅❌' : "l'Intrus 🕵️";
      const next = newQuestion(otherFormat, difficulty);
      return NextResponse.json({
        mode: 'game',
        question: next,
        reply: `Pas de souci, on passe au jeu « ${nom} » ! 🔄\n\n${questionText(next)}`,
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

    // L'enfant ne répond pas au défi mais veut trier un objet / poser une question
    // → on revient en mode conversation et on répond normalement.
    if (intent === 'ask_question') {
      const wasteResults = searchWaste(sanitized);
      const answer = await chatCompletion(sanitized, wasteResults, []);
      return NextResponse.json({
        mode: 'chat',
        question: null,
        reply: `${answer}\n\n_(J'ai mis le jeu de côté 🎮 — dis "on joue" quand tu veux reprendre !)_`,
      });
    }

    // Sinon : c'est une réponse au défi → on corrige
    const result =
      question.format === 'truefalse'
        ? checkTrueFalse(question, sanitized)
        : checkIntruder(question, sanitized);

    const next = newQuestion('random', difficulty);
    return NextResponse.json({
      mode: 'game',
      correct: result.correct,
      question: next,
      reply: `${result.reply}\n\n---\nQuestion suivante ! 👇\n\n${questionText(next)}`,
    });
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}
