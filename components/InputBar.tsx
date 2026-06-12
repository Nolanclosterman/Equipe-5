'use client';

import { useState, useRef, useCallback } from 'react';
import PushToTalkButton from './PushToTalkButton';
import ImageUploadButton from './ImageUploadButton';

interface Props {
  onSendMessage: (text: string) => void;
  onSendImage: (file: File) => void;
  onVoiceError?: (message: string) => void;
  onImageError?: (message: string) => void;
  disabled?: boolean;
}

export default function InputBar({ onSendMessage, onSendImage, onVoiceError, onImageError, disabled }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, disabled, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const handleTranscript = (text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <PushToTalkButton onTranscript={handleTranscript} onError={onVoiceError} disabled={disabled} />
        <ImageUploadButton onImageSelected={onSendImage} onError={onImageError} disabled={disabled} />
        <label
          aria-label="Prendre une photo"
          className={`sm:hidden relative overflow-hidden flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors ${
            disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:bg-gray-200 cursor-pointer'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { onSendImage(file); e.target.value = ''; }
            }}
            disabled={disabled}
          />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
            <circle cx="12" cy="13" r="3"/>
          </svg>
        </label>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Pose ta question sur le tri... ♻️"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 placeholder:whitespace-nowrap placeholder:overflow-hidden outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:opacity-50"
          style={{ minHeight: '44px', maxHeight: '120px' }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          aria-label="Envoyer"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
