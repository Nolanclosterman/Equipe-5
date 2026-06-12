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
      <img
        src="/trico-avatar.png"
        alt="Trico"
        className="h-24 w-24 rounded-full object-cover shadow-sm select-none"
      />
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
        <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline h-4 w-4">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          photo
        </span>
        {' '}ou me{' '}
        <span className="inline-flex items-center gap-1 font-semibold text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline h-4 w-4">
            <rect x="9" y="2" width="6" height="11" rx="3"/>
            <path d="M5 10a7 7 0 0 0 14 0"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="9" y1="22" x2="15" y2="22"/>
          </svg>
          parler
        </span>
        {' '}avec les boutons en bas !
      </p>
    </div>
  );
}
