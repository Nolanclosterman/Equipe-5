#!/usr/bin/env node
/**
 * Runner d'évaluation du chatbot Trico (juge IA complet).
 *
 * 1. Envoie chaque cas de evals/cases.json au chatbot (route /api/chat).
 * 2. Fait noter chaque réponse par Claude (juge) contre la réponse attendue.
 * 3. Écrit un rapport markdown (evals/eval-report.md) et l'affiche.
 *
 * Toujours informatif : sort en code 0 quel que soit le score (ne bloque pas).
 *
 * Variables d'env :
 *   ANTHROPIC_API_KEY  (requis)  — pour le juge ; le serveur en a aussi besoin.
 *   EVAL_BASE_URL      (déf. http://localhost:3000) — où tourne le chatbot.
 *   EVAL_JUDGE_MODEL   (déf. claude-sonnet-4-6)
 *   EVAL_REPORT_PATH   (déf. evals/eval-report.md)
 *
 * Usage local :
 *   npm run build && npm run start &   # ou npm run dev
 *   npm run eval
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charge .env.local (DX local) sans dépendance ; en CI le secret est déjà dans l'env.
if (!process.env.ANTHROPIC_API_KEY) {
  const envPath = path.join(__dirname, '..', '.env.local');
  try {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* pas de .env.local — ok en CI */
  }
}

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000';
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'claude-sonnet-4-6';
const REPORT_PATH = process.env.EVAL_REPORT_PATH || path.join(__dirname, 'eval-report.md');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY manquant — impossible de lancer le juge.');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf-8'));

let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `10.${(ipCounter >> 8) & 255}.${ipCounter & 255}.7`;
}

// Envoie un message au chatbot et renvoie le texte de la réponse.
// Gère la réponse streamée (text/plain) ET les réponses JSON (refus/erreur).
async function askBot(message, history = []) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextIp() },
    body: JSON.stringify({ message, history }),
  });
  const body = await res.text();
  try {
    const j = JSON.parse(body);
    return j.reply ?? j.error ?? body;
  } catch {
    return body; // flux text/plain
  }
}

// Joue un cas (mono ou multi-tours) et renvoie { transcript, lastReply }.
async function runCase(c) {
  if (Array.isArray(c.turns)) {
    const history = [];
    const lines = [];
    let last = '';
    for (const q of c.turns) {
      const reply = await askBot(q, history);
      lines.push(`Enfant: ${q}\nTrico: ${reply}`);
      history.push({ role: 'user', content: q }, { role: 'assistant', content: reply });
      last = reply;
    }
    return { transcript: lines.join('\n\n'), lastReply: last };
  }
  const reply = await askBot(c.question);
  return { transcript: `Enfant: ${c.question}\nTrico: ${reply}`, lastReply: reply };
}

const JUDGE_SYSTEM = `Tu es un évaluateur QA rigoureux et impartial pour "Trico", un chatbot de tri des déchets en Wallonie/Bruxelles qui s'adresse à un enfant de ~12 ans (tutoiement, émojis, ton bienveillant, réponses courtes, reste dans son scope).
On te donne : la conversation, et "ATTENDU" = ce que la bonne réponse doit contenir/respecter.
Évalue UNIQUEMENT la dernière réponse de Trico (sauf si ATTENDU demande de juger la constance sur plusieurs tours).
Rends ton verdict STRICTEMENT en JSON, sans aucun texte autour :
{"verdict":"pass|partial|fail","score":<0.0-1.0>,"reason":"<une phrase concise en français>"}
- "pass" (score >= 0.8) : respecte l'attendu (exactitude + ton).
- "partial" (0.4-0.79) : globalement correct mais il manque un élément clé (ex: bon bac mais info manquante, ou ton un peu off).
- "fail" (< 0.4) : mauvaise info de tri, hallucination, hors-ton, ou ne respecte pas l'attendu.`;

async function judge(c, transcript) {
  const userMsg = `CONVERSATION:\n${transcript}\n\nATTENDU (${c.id}):\n${c.expected}\n\nRends le JSON de verdict.`;
  const resp = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 300,
    system: JUDGE_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = resp.content.find((b) => b.type === 'text')?.text ?? '{}';
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const v = JSON.parse(match ? match[0] : text);
    return {
      verdict: ['pass', 'partial', 'fail'].includes(v.verdict) ? v.verdict : 'fail',
      score: typeof v.score === 'number' ? Math.max(0, Math.min(1, v.score)) : 0,
      reason: String(v.reason ?? '').slice(0, 200),
    };
  } catch {
    return { verdict: 'fail', score: 0, reason: 'Juge: réponse non parsable' };
  }
}

const ICON = { pass: '✅', partial: '🟡', fail: '❌' };

async function evalSuite(label, list) {
  const rows = [];
  for (const c of list) {
    try {
      const { transcript, lastReply } = await runCase(c);
      const v = await judge(c, transcript);
      rows.push({ id: c.id, ...v, reply: lastReply });
      console.log(`${ICON[v.verdict]} ${c.id} (${v.score.toFixed(2)}) — ${v.reason}`);
    } catch (e) {
      rows.push({ id: c.id, verdict: 'fail', score: 0, reason: `Erreur runner: ${e.message}`, reply: '' });
      console.log(`❌ ${c.id} — erreur runner: ${e.message}`);
    }
  }
  return { label, rows };
}

function suiteSummary(rows) {
  const n = rows.length;
  const pass = rows.filter((r) => r.verdict === 'pass').length;
  const partial = rows.filter((r) => r.verdict === 'partial').length;
  const fail = rows.filter((r) => r.verdict === 'fail').length;
  const avg = n ? rows.reduce((s, r) => s + r.score, 0) / n : 0;
  return { n, pass, partial, fail, avg };
}

function renderReport(suites) {
  const lines = ['<!-- trico-eval-report -->', '# 🤖 Rapport d\'éval — chatbot Trico', ''];
  const totals = { n: 0, pass: 0, partial: 0, fail: 0, scoreSum: 0 };
  for (const s of suites) {
    const sm = suiteSummary(s.rows);
    totals.n += sm.n; totals.pass += sm.pass; totals.partial += sm.partial; totals.fail += sm.fail;
    totals.scoreSum += sm.avg * sm.n;
    lines.push(`## ${s.label} — ${(sm.avg * 100).toFixed(0)}% (✅ ${sm.pass} / 🟡 ${sm.partial} / ❌ ${sm.fail})`, '');
    lines.push('| Cas | Verdict | Score | Détail |', '|---|---|---|---|');
    for (const r of s.rows) {
      lines.push(`| ${r.id} | ${ICON[r.verdict]} | ${r.score.toFixed(2)} | ${r.reason.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }
  const overall = totals.n ? totals.scoreSum / totals.n : 0;
  lines.splice(2, 0,
    `**Score global : ${(overall * 100).toFixed(0)}%** — ✅ ${totals.pass} · 🟡 ${totals.partial} · ❌ ${totals.fail} sur ${totals.n} cas`,
    '',
    '> Évaluation par juge IA (informative). Les LLM variant légèrement, un écart de quelques points entre deux runs est normal.',
    '');
  return { report: lines.join('\n'), overall, totals };
}

(async () => {
  console.log(`▶ Évals contre ${BASE_URL} (juge: ${JUDGE_MODEL})\n`);
  // Petit smoke test de disponibilité
  try {
    await fetch(`${BASE_URL}/`, { method: 'GET' });
  } catch {
    console.error(`❌ Chatbot injoignable sur ${BASE_URL}. Lance le serveur d'abord.`);
    process.exit(1);
  }

  const suites = [];
  suites.push(await evalSuite('Exactitude du tri (chatbot-evals.md)', cases.functional));
  suites.push(await evalSuite('Personnalité (personality.md)', cases.personality));

  const { report, overall, totals } = renderReport(suites);
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Score global : ${(overall * 100).toFixed(0)}% (✅ ${totals.pass} / 🟡 ${totals.partial} / ❌ ${totals.fail} sur ${totals.n})`);
  console.log(`Rapport écrit : ${REPORT_PATH}`);
  // Informatif : on ne bloque jamais.
  process.exit(0);
})();
