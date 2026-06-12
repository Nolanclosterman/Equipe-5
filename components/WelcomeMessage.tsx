'use client';

interface Props {
  onSelect?: (query: string) => void;
}

const SUGGESTIONS = [
  { emoji: '🥫', label: 'Canette alu', query: 'Où je jette une canette en alu ?' },
  { emoji: '📱', label: 'Vieux GSM', query: 'Comment je recycle un vieux GSM ?' },
  { emoji: '🍾', label: 'Bouteille verre', query: 'Où va une bouteille en verre ?' },
  { emoji: '🔋', label: 'Pile usagée', query: 'Comment je jette une pile usagée ?' },
  { emoji: '📦', label: 'Carton', query: 'Où je mets un carton ?' },
];

export default function WelcomeMessage({ onSelect }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 text-center">
      <div className="text-6xl">♻️</div>
      <h2 className="text-2xl font-bold text-green-700">Salut ! Je suis Trico 👋</h2>
      <p className="max-w-sm text-base text-gray-600 leading-relaxed">
        Je suis ton expert du tri des déchets en Wallonie et à Bruxelles ! Pose-moi
        une question, ou choisis un exemple ci-dessous. 🌍
      </p>

      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSelect?.(s.query)}
            className="rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800 transition-colors hover:bg-green-200 active:scale-95"
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Point kids at the two superpowers most likely to be missed. */}
      <p className="mt-3 max-w-sm text-sm text-gray-500 leading-relaxed">
        👇 Tu peux aussi m&apos;envoyer une{' '}
        <span className="font-semibold text-blue-600">📷 photo</span> ou me{' '}
        <span className="font-semibold text-green-600">🎤 parler</span> avec les
        boutons en bas !
      </p>
    </div>
  );
}
