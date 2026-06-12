'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionCompat;
  }
}

interface SpeechRecognitionCompat extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface Props {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export default function PushToTalkButton({ onTranscript, onError, disabled }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionCompat | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setIsSupported(typeof w.SpeechRecognition === 'function' || typeof w.webkitSpeechRecognition === 'function');
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isListening || disabled) return;

    if (!window.isSecureContext) {
      onError?.('La reconnaissance vocale nécessite HTTPS. Déploie sur Vercel ou utilise ngrok pour tester en local. 🔒');
      return;
    }

    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.webkitSpeechRecognition ?? w.SpeechRecognition) as (new () => SpeechRecognitionCompat) | undefined;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'fr-BE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = (event: { error: string }) => {
      setIsListening(false);
      recognitionRef.current = null;
      const messages: Record<string, string> = {
        'not-allowed': 'Accès au micro refusé. Autorise le microphone dans les réglages de ton navigateur. 🎤',
        'service-not-allowed': 'La reconnaissance vocale nécessite HTTPS. En local, utilise ngrok ou teste sur Vercel. 🔒',
        'network': 'Erreur réseau. Vérifie ta connexion internet. 🌐',
      };
      const msg = messages[event.error];
      if (msg) onError?.(msg);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      recognitionRef.current = null;
      const err = e as DOMException;
      if (err.name === 'NotAllowedError') {
        onError?.('Accès au micro refusé. Autorise le microphone dans les réglages de ton navigateur. 🎤');
      } else {
        onError?.(`Impossible de démarrer le micro (${err.name ?? 'erreur inconnue'}). Vérifie que la page est en HTTPS. 🔒`);
      }
    }
  }, [isSupported, isListening, disabled, onTranscript, onError]);

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled || !isSupported}
      aria-label={isListening ? 'Arrêter la dictée' : 'Dicter un message'}
      title={!isSupported ? 'Ton navigateur ne supporte pas la reconnaissance vocale' : isListening ? 'Clique pour arrêter' : 'Clique pour dicter'}
      className={`flex h-11 w-11 flex-none items-center justify-center rounded-full transition-colors ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-green-50 text-green-600 hover:bg-green-100'
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
