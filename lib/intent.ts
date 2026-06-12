import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ChatIntent = 'start_game' | 'ask_question' | 'chitchat';
export type GameIntent =
  | 'answer_game'
  | 'dont_know'
  | 'new_game'
  | 'ask_question'
  | 'quit_game';

type Mode = 'chat' | 'game';

const CHAT_INSTRUCTIONS = `Classe l'intention d'un message d'enfant qui discute avec un chatbot sur le tri des déchets.
Intentions possibles :
- "start_game" : l'enfant veut jouer / faire un quiz / un défi (ex: "on joue ?", "un quiz !", "je veux un jeu", "défie-moi").
- "ask_question" : l'enfant pose une question sur les déchets, le tri, le recyclage.
- "chitchat" : salutation, remerciement, ou message sans rapport.`;

const GAME_INSTRUCTIONS = `Un enfant est EN TRAIN DE JOUER à un jeu de tri (une question vient de lui être posée).
Classe son message :
- "answer_game" : il répond au défi (ex: "vrai", "faux", "le numéro 2", "la canette", "sac bleu"). Les réponses de jeu sont souvent COURTES.
- "dont_know" : il ne sait pas, hésite ou demande la réponse (ex: "je sais pas", "chais pas", "aucune idée", "j'hésite", "c'est quoi la réponse ?", "dis-moi", "?", "hmm", "trop dur").
- "new_game" : il veut une AUTRE question ou changer de jeu, mais CONTINUER à jouer (ex: "on change de jeu", "autre question", "passe", "je veux un autre défi", "change", "suivant").
- "ask_question" : il pose une nouvelle question sur les déchets au lieu de répondre (ex: "attends, c'est quoi le PMC ?").
- "quit_game" : il veut ARRÊTER complètement de jouer (ex: "stop", "j'arrête", "on arrête de jouer", "j'en ai marre", "je veux juste discuter").`;

function buildPrompt(message: string, mode: Mode): string {
  const instructions = mode === 'game' ? GAME_INSTRUCTIONS : CHAT_INSTRUCTIONS;
  return `${instructions}

Message de l'enfant : "${message}"

Réponds UNIQUEMENT avec un JSON de cette forme exacte, sans rien autour :
{"intent": "..."}`;
}

async function classify(message: string, mode: Mode): Promise<string | null> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 64,
    messages: [{ role: 'user', content: buildPrompt(message, mode) }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(text);
    return typeof parsed.intent === 'string' ? parsed.intent : null;
  } catch {
    console.error('[intent] JSON parse failed. Raw:', raw);
    return null;
  }
}

export async function classifyChatIntent(message: string): Promise<ChatIntent> {
  const intent = await classify(message, 'chat');
  if (intent === 'start_game' || intent === 'ask_question' || intent === 'chitchat') {
    return intent;
  }
  return 'ask_question'; // repli sûr : on répond normalement
}

export async function classifyGameIntent(message: string): Promise<GameIntent> {
  const intent = await classify(message, 'game');
  if (
    intent === 'answer_game' ||
    intent === 'dont_know' ||
    intent === 'new_game' ||
    intent === 'ask_question' ||
    intent === 'quit_game'
  ) {
    return intent;
  }
  return 'answer_game'; // repli sûr : on traite comme une réponse au défi
}
