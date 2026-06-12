import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { searchWaste } from '@/lib/search';
import { visionAnalysis, chatCompletion } from '@/lib/claude';
import { logUnknownTerm } from '@/lib/db';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const file = formData.get('image');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Aucune image reçue.' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "L'image est trop lourde ! 😮 Maximum 5 Mo." },
      { status: 413 }
    );
  }

  const mediaType = file.type || 'image/jpeg';
  if (!ALLOWED_TYPES.includes(mediaType)) {
    return NextResponse.json(
      { error: 'Format non supporté. Envoie un JPEG, PNG, GIF ou WebP !' },
      { status: 415 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  try {
    const { identified, wasteName, reply: visionReply } = await visionAnalysis(base64, mediaType);

    if (!identified || !wasteName) {
      return NextResponse.json({ reply: visionReply });
    }

    const wasteResults = searchWaste(wasteName);

    if (wasteResults.length === 0) {
      logUnknownTerm(wasteName.toLowerCase().slice(0, 60));
      return NextResponse.json({ reply: visionReply });
    }

    const fullReply = await chatCompletion(
      `J'ai identifié : ${wasteName}. Comment est-ce qu'on recycle ou jette ça ?`,
      wasteResults,
      []
    );

    return NextResponse.json({ reply: fullReply, wasteName });
  } catch (error) {
    console.error('[image] Vision API error:', error);
    return NextResponse.json(
      {
        reply:
          "Je n'ai pas réussi à analyser cette image. 🤔 Essaie avec une autre photo ou décris le déchet en texte !",
      },
      { status: 200 }
    );
  }
}
