'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Extend window for webkit prefix
declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionCompat;
  }
}

interface SpeechRecognitionCompat extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function PushToTalkButton({ onTranscript, disabled }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionCompat | null>(null);

  useEffect(() => {
    setIsSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isListening || disabled) return;

    const Ctor =
      typeof window !== 'undefined'
        ? (window.webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition: new () => SpeechRecognitionCompat }).SpeechRecognition)
        : null;

    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'fr-BE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, isListening, disabled, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return (
    <button
      type="button"
      onPointerDown={isSupported ? startListening : undefined}
      onPointerUp={isSupported ? stopListening : undefined}
      onPointerLeave={isSupported ? stopListening : undefined}
      disabled={disabled || !isSupported}
      aria-label={isListening ? 'Arrêter la dictée' : 'Parler'}
      title={!isSupported ? 'Ton navigateur ne supporte pas la reconnaissance vocale' : undefined}
      className={`flex h-11 w-11 flex-none items-center justify-center rounded-full transition-colors ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="9" y="2" width="6" height="11" rx="3"/>
        <path d="M5 10a7 7 0 0 0 14 0"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="9" y1="22" x2="15" y2="22"/>
      </svg>
    </button>
  );
}
