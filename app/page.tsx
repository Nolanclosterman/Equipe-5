'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Message } from '@/lib/claude';
import ChatWindow from '@/components/ChatWindow';
import InputBar from '@/components/InputBar';

const STORAGE_KEY = 'trico_history';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from localStorage — must be in useEffect to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;
      setError(null);

      const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
      appendMessage(userMsg);
      setIsLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: messages }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'Erreur inconnue.');
        } else {
          appendMessage({
            role: 'assistant',
            content: data.reply,
            timestamp: Date.now(),
          });
        }
      } catch {
        setError('Pas de connexion. Vérifie ton internet et réessaie ! 🌐');
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  const sendImage = useCallback(
    async (file: File) => {
      if (isLoading) return;
      setError(null);

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
          setError(data.error ?? 'Erreur inconnue.');
        } else {
          appendMessage({
            role: 'assistant',
            content: data.reply,
            timestamp: Date.now(),
          });
        }
      } catch {
        setError('Pas de connexion. Vérifie ton internet et réessaie ! 🌐');
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
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
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex-none bg-red-50 border-b border-red-200 px-4 py-2">
          <p className="text-sm text-red-700 text-center">{error}</p>
        </div>
      )}

      {/* Messages */}
      <ChatWindow messages={messages} isLoading={isLoading} />

      {/* Input */}
      <InputBar
        onSendMessage={sendMessage}
        onSendImage={sendImage}
        onVoiceError={setError}
        disabled={isLoading}
      />
    </div>
  );
}
