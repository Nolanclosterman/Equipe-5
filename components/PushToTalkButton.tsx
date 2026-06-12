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

  // Detect support only after mount so server and first client render match (both null).
  useEffect(() => {
    setIsSupported(
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    );
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

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onPointerDown={startListening}
      onPointerUp={stopListening}
      onPointerLeave={stopListening}
      disabled={disabled}
      aria-label={isListening ? 'Arrêter la dictée' : 'Parler'}
      className={`flex h-11 w-11 flex-none items-center justify-center rounded-full transition-colors ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } disabled:opacity-40`}
    >
      🎤
    </button>
  );
}
