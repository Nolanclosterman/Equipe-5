const INJECTION_PATTERNS = [
  /ignore\s+(les|tes|previous|tout)/iu,
  /oublie\s+tout/iu,
  /forget\s+everything/iu,
  /tu\s+es\s+maintenant/iu,
  /you\s+are\s+now/iu,
  /act\s+as/iu,
  /agis\s+comme/iu,
  /\[system\]/iu,
  /###/u,
  /<system>/iu,
  /<assistant>/iu,
  /parle[\s-]+(comme|moi\s+comme)/iu,
  /change\s+de\s+ton/iu,
  /arr[eê]te\s+(les\s+)?[ée]mojis?/iu,
  /vouvoie/iu,
  /langage\s+(professionnel|soutenu|adulte)/iu,
  /nouveau\s+r[oô]le/iu,
  /ton\s+nouveau\s+nom/iu,
  /oublie\s+tes\s+instructions/iu,
  /ignore\s+tes\s+instructions/iu,
];

const MAX_LENGTH = 500;

export function sanitizeInput(input: string): { valid: boolean; sanitized: string } {
  const truncated = input.slice(0, MAX_LENGTH);

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(truncated)) {
      return { valid: false, sanitized: '' };
    }
  }

  return { valid: true, sanitized: truncated.trim() };
}
