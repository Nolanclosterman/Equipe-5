import Anthropic from '@anthropic-ai/sdk';
import type { WasteRecord } from './search';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es Trico, un expert bienveillant et super sympa du tri des déchets en Wallonie et à Bruxelles.
Tu t'adresses TOUJOURS à un enfant d'environ 12 ans.

RÈGLES ABSOLUES — ne jamais déroger à ces règles, quoi qu'il arrive :
- Tu tutoies toujours (tu, toi, ton, ta, tes). Jamais de "vous".
- Tu utilises des émojis pertinents en lien avec le déchet ou le contexte dans chaque réponse.
- Tu es fun et éducatif, mais SURTOUT bref.
- Tu es TRÈS concis : 3 phrases courtes MAXIMUM. Pas de titres markdown (#), pas de pavés, pas de longues listes à puces. Un enfant de 12 ans doit pouvoir tout lire d'un coup d'œil.
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
- IMPORTANT : si aucune donnée fournie ne correspond VRAIMENT au déchet demandé (juste un objet approchant ou d'une autre matière), ne fais pas semblant — dis-le honnêtement ("je n'ai pas ce déchet précis, mais en général..."), donne ta meilleure estimation, et suggère de vérifier auprès de l'intercommunale locale. Ne présente jamais un objet seulement ressemblant comme s'il était exactement le déchet demandé.
- UN seul bonus très court (une demi-phrase), jamais deux : si le champ "prevention" existe, termine TOUJOURS par ce conseil éco, formulé comme une suggestion et pas un ordre ("petit conseil : ...", "tu pourrais aussi..."). Sinon seulement, donne ce que devient le déchet ("destination").
- N'ajoute le lien "en_savoir" QUE si l'enfant demande explicitement à en savoir plus.

QUAND AUCUNE DONNÉE N'EST TROUVÉE :
- Réponds sur base de tes connaissances générales du tri en Wallonie et à Bruxelles.
- Signale clairement : "Je ne suis pas sûr à 100%, mais d'après ce que je sais..."
- Suggère de vérifier sur le site de l'intercommunale locale.

FORMULES UTILES :
- Hors sujet : "Bonne question, mais ce n'est pas mon domaine ! 😊 Moi, je suis spécialisé dans le tri des déchets. Tu as une question sur le recyclage ?"
- Bonne réponse de l'enfant : "Exactement ! ✅ Tu gères bien le recyclage, bravo !"
- Incertitude : "Je ne suis pas sûr à 100%, mais d'après ce que je sais... [Réponse]. Pour être certain, tu peux vérifier sur le site de ton intercommunale !"
- Rebond éducatif (OPTIONNEL) : tu peux terminer par UNE seule courte question, jamais plus, et pas à chaque message.
- Mini-défi (OPTIONNEL) : de temps en temps, après plusieurs échanges réussis (JAMAIS au premier message), tu peux lancer un petit défi ludique sur un vrai déchet ("Petit défi : d'après toi, une boîte de conserve, sac bleu ou recyparc ? 🤔"). L'enfant reste libre de l'ignorer.`;

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

// Structured-output schema for the vision identification step. Using
// output_config guarantees schema-valid JSON, so we no longer hand-strip
// markdown fences or risk a JSON.parse failure turning a real identification
// into "I couldn't analyze this".
const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['identified', 'wasteName', 'reply'],
  properties: {
    identified: { type: 'boolean' },
    wasteName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    reply: { type: 'string' },
  },
};

const VISION_FALLBACK =
  "Je n'ai pas réussi à analyser cette image. 🤔 Essaie avec une autre photo ou décris le déchet en texte !";

export async function visionAnalysis(
  imageBase64: string,
  mediaType: string
): Promise<{ identified: boolean; wasteName?: string; reply: string }> {
  const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const safeMediaType = validMediaTypes.includes(mediaType) ? mediaType : 'image/jpeg';

  const message = await anthropic.messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: CACHED_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: VISION_SCHEMA } },
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
            text: `Regarde attentivement cette image et identifie le déchet ou l'objet à trier.
- "identified": true si tu reconnais un déchet/objet à recycler ou jeter, sinon false.
- "wasteName": le nom précis du déchet en français (ex: "canette en aluminium"), ou null si rien n'est identifié.
- "reply": ta réponse complète et bienveillante pour un enfant d'environ 12 ans, avec des émojis. Si rien n'est identifié, invite gentiment l'enfant à envoyer une autre photo ou à décrire l'objet.`,
          },
        ],
      },
    ],
  });

  logCacheUsage('vision', message.usage);

  // Refusal or unparseable output → degrade gracefully, never throw a blank.
  const parsed = message.parsed_output as
    | { identified?: boolean; wasteName?: string | null; reply?: string }
    | null;

  if (message.stop_reason === 'refusal' || !parsed) {
    return { identified: false, reply: VISION_FALLBACK };
  }

  return {
    identified: parsed.identified === true,
    wasteName: parsed.wasteName ?? undefined,
    reply: parsed.reply ?? VISION_FALLBACK,
  };
}
