export default function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 text-center">
      <div className="text-6xl">♻️</div>
      <h2 className="text-2xl font-bold text-green-700">Salut ! Je suis Trico 👋</h2>
      <p className="max-w-sm text-base text-gray-600 leading-relaxed">
        Je suis ton expert du tri des déchets en Wallonie et à Bruxelles ! Pose-moi
        une question, envoie une photo ou parle-moi d'un objet dont tu veux savoir comment le recycler. 🌍
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {[
          '🥫 Canette alu',
          '📱 Vieux GSM',
          '🍾 Bouteille verre',
          '🔋 Pile usagée',
          '📦 Carton',
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800 font-medium"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}
