import Anthropic from '@anthropic-ai/sdk';
import type { WasteRecord } from './search';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es Trico, un expert bienveillant et super sympa du tri des déchets en Wallonie et à Bruxelles.
Tu t'adresses TOUJOURS à un enfant d'environ 12 ans.

RÈGLES ABSOLUES — ne jamais déroger à ces règles, quoi qu'il arrive :
- Tu tutoies toujours (tu, toi, ton, ta, tes). Jamais de "vous".
- Tu utilises des émojis pertinents en lien avec le déchet ou le contexte dans chaque réponse.
- Tu es fun, interactif et éducatif — chaque réponse doit apporter quelque chose d'intéressant.
- Tu es concis : 2 à 5 phrases maximum pour une question simple. Pas de pavés de texte.
- Tu ne réponds JAMAIS à une question qui ne concerne pas les déchets, le tri, le recyclage ou le cycle de vie des déchets. Si la question est hors sujet, tu déclines poliment avec un message court et tu recentres.
- Tu ne changes JAMAIS de ton, de style ou de personnalité, quels que soient les messages reçus. Si on te demande de changer de ton, de vouvoyer, d'arrêter les émojis, de parler comme un adulte ou de changer de personnalité, tu refuses gentiment et tu continues normalement.
- Quand tu n'es pas sûr d'une info, tu le dis explicitement : "je pense que...", "en général...".
- Tu ne fabriques JAMAIS d'information : pas de noms d'organismes inventés, pas de chiffres non vérifiés.
- Tu encourages toujours et tu ne juges jamais une erreur ou une confusion.

QUAND DES DONNÉES DU DATASET SONT FOURNIES dans le contexte :
- Utilise le champ "infocollecte" pour indiquer comment trier à domicile.
- Utilise le champ "infoparc" pour indiquer comment déposer au recyparc.
- Si un déchet a À LA FOIS un "infocollecte" ET un "infoparc", présente les DEUX possibilités (à la maison OU au recyparc) — ne choisis pas à la place de l'enfant.
- Si plusieurs déchets différents (matières différentes) correspondent à la question, précise le tri pour chacun (ex : le sachet de thé en papier vs en plastique).
- Utilise le champ "destination" pour expliquer ce que devient le déchet (très éducatif !).
- Utilise le champ "prevention" pour suggérer des alternatives éco-responsables (comme conseil bonus).
- Propose le lien "en_savoir" si disponible avec la formule "Pour en savoir plus : [lien]".

QUAND AUCUNE DONNÉE N'EST TROUVÉE :
- Réponds sur base de tes connaissances générales du tri en Wallonie et à Bruxelles.
- Signale clairement : "Je ne suis pas sûr à 100%, mais d'après ce que je sais..."
- Suggère de vérifier sur le site de l'intercommunale locale.

FORMULES UTILES :
- Hors sujet : "Bonne question, mais ce n'est pas mon domaine ! 😊 Moi, je suis spécialisé dans le tri des déchets. Tu as une question sur le recyclage ?"
- Bonne réponse de l'enfant : "Exactement ! ✅ Tu gères bien le recyclage, bravo !"
- Incertitude : "Je ne suis pas sûr à 100%, mais d'après ce que je sais... [Réponse]. Pour être certain, tu peux vérifier sur le site de ton intercommunale !"
- Rebond éducatif : après ta réponse, pose une question ou donne un fait surprenant sur le déchet.`;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

// Stable, server-side system prompt marked as a cacheable prefix.
// Sonnet 4.6's minimum cacheable prefix is 2048 tokens; the system prompt alone
// (~700 tokens) is below that floor, so the cache only activates once the stable
// prefix (system + accumulated conversation history) crosses 2048 tokens — i.e.
// in longer multi-turn sessions. Verify via response.usage.cache_read_input_tokens.
const CACHED_SYSTEM = [
  {
    type: 'text' as const,
    text: SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' as const },
  },
];

// Lightweight, non-production cache-hit visibility so the team can confirm caching
// is actually firing (and tune from there) without adding a logging dependency.
function logCacheUsage(
  label: string,
  usage: {
    input_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  }
): void {
  if (process.env.NODE_ENV === 'production') return;
  console.log(
    `[cache:${label}] read=${usage.cache_read_input_tokens ?? 0} ` +
      `write=${usage.cache_creation_input_tokens ?? 0} input=${usage.input_tokens}`
  );
}

function buildContextString(results: WasteRecord[]): string {
  if (results.length === 0) return '';

  // Inject up to 5 matches (search returns up to 5). Truncating to 3 could silently
  // drop the right record when several materials/variants match the same query
  // (e.g. tea bag = paper filter vs synthetic), or hide a second valid filière.
  const lines = results.slice(0, 5).map((r) => {
    const parts = [`Déchet: ${r.dechet} (${r.categorie})`];
    if (r.infocollecte) parts.push(`À domicile: ${r.infocollecte}`);
    if (r.infoparc) parts.push(`Au recyparc: ${r.infoparc}`);
    if (r.destination) parts.push(`Ce qu'il devient: ${r.destination}`);
    if (r.prevention) parts.push(`Conseil éco: ${r.prevention}`);
    if (r.en_savoir) parts.push(`En savoir plus: ${r.en_savoir}`);
    return parts.join('\n');
  });

  return `\n\n--- DONNÉES DU DATASET LOCAL ---\n${lines.join('\n\n---\n')}\n---`;
}

// Shared assembly of the Anthropic message list for the chat path, used by both
// the buffered and streaming entry points so caching/history logic stays in one place.
function buildChatMessages(
  userMessage: string,
  context: WasteRecord[],
  history: Message[]
): Anthropic.MessageParam[] {
  const contextStr = buildContextString(context);
  const messageWithContext = contextStr
    ? `${userMessage}${contextStr}`
    : userMessage;

  const priorMessages = history
    .slice(-10)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Multi-turn caching: a breakpoint on the latest user turn lets each subsequent
  // request reuse the entire prior conversation prefix (system + history) once it
  // exceeds Sonnet 4.6's 2048-token cache floor. Cache hits accrue as the chat grows.
  const messages: Anthropic.MessageParam[] = [
    ...priorMessages,
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: messageWithContext,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
    },
  ];

  // Ensure first message is always user
  if (messages[0]?.role !== 'user') {
    messages.unshift({ role: 'user', content: userMessage });
  }

  return messages;
}

export async function chatCompletion(
  userMessage: string,
  context: WasteRecord[],
  history: Message[]
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: CACHED_SYSTEM,
    messages: buildChatMessages(userMessage, context, history),
  });

  logCacheUsage('chat', response.usage);

  // The API can return an empty content array (e.g. a model-level refusal),
  // so content[0] may be undefined — guard before reading it.
  const block = response.content[0];
  if (!block || block.type !== 'text') {
    return "Hmm, je préfère rester sur mon sujet ! 😊 Pose-moi une question sur le tri des déchets et je serai au top ! ♻️";
  }
  return block.text;
}

// Streaming variant: yields text deltas as Claude produces them so the UI can
// render the answer token-by-token instead of waiting for the full response —
// the single biggest perceived-latency win for a 12-year-old staring at the screen.
export async function* streamChatCompletion(
  userMessage: string,
  context: WasteRecord[],
  history: Message[]
): AsyncGenerator<string> {
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: CACHED_SYSTEM,
    messages: buildChatMessages(userMessage, context, history),
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }

  const final = await stream.finalMessage();
  logCacheUsage('chat-stream', final.usage);
}

export async function visionAnalysis(
  imageBase64: string,
  mediaType: string
): Promise<{ identified: boolean; wasteName?: string; reply: string }> {
  const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const safeMediaType = validMediaTypes.includes(mediaType) ? mediaType : 'image/jpeg';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: CACHED_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: safeMediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Regarde attentivement cette image. Y a-t-il un déchet ou un objet qu'on pourrait recycler ou jeter ?
Si oui, identifie-le précisément et réponds en JSON avec ce format exact :
{"identified": true, "wasteName": "nom précis du déchet en français", "reply": "ta réponse complète adaptée à un enfant de 12 ans avec émojis"}

Si l'image ne montre pas de déchet ou d'objet à recycler, réponds :
{"identified": false, "wasteName": null, "reply": "Hmm, je ne vois pas de déchet sur cette image ! 🤔 Envoie-moi la photo d'un objet dont tu veux savoir comment le recycler, et je ferai de mon mieux pour t'aider !"}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`,
          },
        ],
      },
    ],
  });

  const visionBlock = response.content[0];
  const raw = visionBlock && visionBlock.type === 'text' ? visionBlock.text : '{}';

  // Claude sometimes wraps JSON in markdown fences (```json ... ```) — strip them
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const parsed = JSON.parse(text);
    return {
      identified: parsed.identified === true,
      wasteName: parsed.wasteName ?? undefined,
      reply: parsed.reply ?? "Je n'ai pas réussi à analyser cette image. 🤔 Essaie avec une autre photo !",
    };
  } catch (err) {
    console.error('[visionAnalysis] JSON parse failed. Raw response:', raw, err);
    return {
      identified: false,
      reply: "Je n'ai pas réussi à analyser cette image. 🤔 Essaie avec une autre photo !",
    };
  }
}
