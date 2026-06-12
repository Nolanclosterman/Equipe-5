'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Message } from '@/lib/claude';
import ChatWindow from '@/components/ChatWindow';
import InputBar from '@/components/InputBar';
import MischiefGame from '@/components/MischiefGame';
import Confetti from '@/components/Confetti';
import { detectBins } from '@/lib/bins';

const STORAGE_KEY = 'trico_history';
const DISCOVERED_KEY = 'trico_discovered';
const INJECTION_COUNT_KEY = 'trico_injection_count';
const INJECTION_THRESHOLD = 5;

// Stock phrases Trico falls back on when declining an off-topic question. They
// come from the system-prompt formulas and never appear in a genuine
// waste-sorting answer, so they're a low-false-positive signal of a refusal.
// Checked client-side on the assembled reply, since the answer is streamed.
const OFF_TOPIC_MARKERS = ['pas mon domaine', 'pas mon truc', 'bien essaye', 'bonne tentative', 'je reste trico'];

function looksLikeOffTopicRefusal(reply: string): boolean {
  const normalized = reply
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip accents so "essayé" matches "essaye"
  return OFF_TOPIC_MARKERS.some((marker) => normalized.includes(marker));
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [discovered, setDiscovered] = useState(0);
  const [celebrate, setCelebrate] = useState(0);

  // Hydrate from localStorage — must be in useEffect to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
      const storedCount = parseInt(localStorage.getItem(DISCOVERED_KEY) ?? '', 10);
      if (!Number.isNaN(storedCount)) setDiscovered(storedCount);
    } catch {
      // Ignore corrupt storage
    }
  }, []);

  // Persist history on every change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
      } catch {
        // Quota exceeded or private mode — silently ignore
      }
    }
  }, [messages]);

  const appendMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  // When the bot gives a real sorting answer (a known bin is named), count it as
  // an object discovered and fire a short celebration — immediate, friendly
  // feedback that rewards the kid for learning. Counter is localStorage-only.
  const rewardIfSorted = (reply: string) => {
    if (!reply || detectBins(reply).length === 0) return;
    setDiscovered((d) => {
      const next = d + 1;
      try {
        localStorage.setItem(DISCOVERED_KEY, String(next));
      } catch {
        // Storage unavailable — counter just won't persist
      }
      return next;
    });
    setCelebrate((c) => c + 1);
  };

  // Surface failures as an in-character Trico bubble in the chat, never a scary
  // red banner or a browser alert — keeps every dead-end kind and in-place.
  // Memoized (uses only the stable setMessages) so it's a safe useCallback dep.
  const appendBotBubble = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'assistant', content: text, timestamp: Date.now() }]);
  }, []);

  // Count blocked injection attempts (client-side). After the threshold, unlock
  // the "Vrai déchet ou Triche ?" easter egg and reset the counter so it can be
  // earned again.
  const handleInjectionDetected = () => {
    try {
      const next = (parseInt(localStorage.getItem(INJECTION_COUNT_KEY) ?? '0', 10) || 0) + 1;
      if (next >= INJECTION_THRESHOLD) {
        localStorage.setItem(INJECTION_COUNT_KEY, '0');
        setShowGame(true);
      } else {
        localStorage.setItem(INJECTION_COUNT_KEY, String(next));
      }
    } catch {
      // Storage unavailable (private mode) — easter egg simply won't trigger
    }
  };

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
      appendMessage(userMsg);
      setIsLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: messages }),
        });

        const contentType = res.headers.get('Content-Type') ?? '';

        // Error and sanitize-reject responses still come back as JSON with a
        // status code; only the successful reply is streamed as text.
        if (!res.ok || !contentType.includes('text/plain') || !res.body) {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            appendBotBubble(data.error ?? "Oups, petit souci ! 😅 Réessaie dans un instant.");
          } else {
            appendMessage({
              role: 'assistant',
              content: data.reply ?? '',
              timestamp: Date.now(),
            });
            if (data.injection) handleInjectionDetected();
          }
          return;
        }

        // Streaming path: grow a single assistant bubble as deltas arrive.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const ts = Date.now();
        let acc = '';
        let started = false;

        const applyChunk = () => {
          if (!started) {
            started = true;
            setIsLoading(false); // replace the typing dots with the live bubble
            appendMessage({ role: 'assistant', content: acc, timestamp: ts });
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.role === 'assistant' && m.timestamp === ts ? { ...m, content: acc } : m
              )
            );
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          applyChunk();
        }
        acc += decoder.decode(); // flush any trailing multi-byte char (accents/emojis)
        applyChunk();
        rewardIfSorted(acc);

        // Off-topic refusals stream as normal text (no JSON flag), so detect them
        // here on the full reply to also feed the easter-egg counter.
        if (looksLikeOffTopicRefusal(acc)) handleInjectionDetected();
      } catch {
        appendBotBubble("Oups, j'ai perdu le fil ! 🌐 Vérifie ta connexion internet et réessaie 😊");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, appendBotBubble]
  );

  const sendImage = useCallback(
    async (file: File) => {
      if (isLoading) return;

      const userMsg: Message = {
        role: 'user',
        content: `📷 Photo envoyée : ${file.name}`,
        timestamp: Date.now(),
      };
      appendMessage(userMsg);
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/image', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          appendBotBubble(data.error ?? "Oups, petit souci ! 😅 Réessaie dans un instant.");
        } else {
          appendMessage({
            role: 'assistant',
            content: data.reply,
            timestamp: Date.now(),
          });
          rewardIfSorted(data.reply);
        }
      } catch {
        appendBotBubble("Oups, j'ai perdu le fil ! 🌐 Vérifie ta connexion internet et réessaie 😊");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, appendBotBubble]
  );

  const clearHistory = () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Header */}
      <header className="flex-none border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">♻️</span>
            <div>
              <h1 className="text-lg font-extrabold text-green-700 leading-tight">Trico</h1>
              <p className="text-xs text-gray-500 leading-tight">Expert du tri en Wallonie &amp; Bruxelles</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {discovered > 0 && (
              <span
                className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700"
                title="Objets que tu as appris à trier"
                aria-label={`${discovered} objets découverts`}
              >
                🌟 {discovered}
              </span>
            )}
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Effacer la conversation"
              >
                Effacer
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        onPickSuggestion={sendMessage}
      />

      {/* Input */}
      <InputBar
        onSendMessage={sendMessage}
        onSendImage={sendImage}
        onVoiceError={appendBotBubble}
        onImageError={appendBotBubble}
        disabled={isLoading}
      />

      {/* Celebration burst when a sorting answer is given */}
      <Confetti trigger={celebrate} />

      {/* Easter egg: unlocked after repeated injection attempts */}
      {showGame && <MischiefGame onClose={() => setShowGame(false)} />}
    </div>
  );
}
