'use client';

import { useState, useRef, useCallback } from 'react';
import PushToTalkButton from './PushToTalkButton';
import ImageUploadButton from './ImageUploadButton';

interface Props {
  onSendMessage: (text: string) => void;
  onSendImage: (file: File) => void;
  disabled?: boolean;
}

export default function InputBar({ onSendMessage, onSendImage, disabled }: Props) {
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
        <PushToTalkButton onTranscript={handleTranscript} disabled={disabled} />
        <ImageUploadButton onImageSelected={onSendImage} disabled={disabled} />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Pose ta question sur le tri... ♻️"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200 disabled:opacity-50"
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
            fill="currentColor"
            className="h-5 w-5 rotate-90"
          >
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
