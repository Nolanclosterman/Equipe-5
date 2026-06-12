'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/lib/claude';
import MessageBubble from './MessageBubble';
import WelcomeMessage from './WelcomeMessage';

interface Props {
  messages: Message[];
  isLoading: boolean;
  onPickSuggestion?: (query: string) => void;
}

export default function ChatWindow({ messages, isLoading, onPickSuggestion }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div
      className="h-full overflow-y-auto px-4"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 4.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)',
      }}
    >
      {messages.length === 0 ? (
        <WelcomeMessage onSelect={onPickSuggestion} />
      ) : (
        <div className="mx-auto max-w-2xl">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <img
                src="/trico-avatar.png"
                alt="Trico"
                className="mr-2 mt-1 h-8 w-8 flex-none rounded-full object-cover select-none"
              />
              <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
