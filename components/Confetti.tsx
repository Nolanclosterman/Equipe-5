'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

// A lightweight, dependency-free emoji burst shown briefly when the kid gets a
// sorting answer. Driven by a `trigger` counter — bumping it replays the burst.
const EMOJIS = ['♻️', '🌿', '💚', '⭐', '🎉', '🌍', '🥳'];
const PIECE_COUNT = 18;
const DURATION_MS = 1700;

interface Piece {
  id: number;
  left: number;
  delay: number;
  emoji: string;
  rotate: number;
}

export default function Confetti({ trigger }: { trigger: number }) {
  // Pieces are derived from `trigger` during render with deterministic, well-
  // spread positions (no Math.random — keeps the memo pure and lint-clean).
  const pieces = useMemo<Piece[]>(() => {
    if (trigger <= 0) return [];
    return Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: trigger * 100 + i,
      left: (i * 61) % 100,
      delay: (i % 6) * 0.04,
      emoji: EMOJIS[i % EMOJIS.length],
      rotate: ((i * 47) % 180) - 90,
    }));
  }, [trigger]);

  // After the animation, mark this trigger as done so the burst unmounts. The
  // setState runs inside the timeout (async), not synchronously in the effect.
  const [doneTrigger, setDoneTrigger] = useState(0);
  useEffect(() => {
    if (trigger <= 0) return;
    const t = setTimeout(() => setDoneTrigger(trigger), DURATION_MS);
    return () => clearTimeout(t);
  }, [trigger]);

  if (trigger <= 0 || trigger === doneTrigger || pieces.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute text-2xl"
          style={
            {
              left: `${p.left}%`,
              top: '-10%',
              animationDelay: `${p.delay}s`,
              '--rot': `${p.rotate}deg`,
            } as CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
