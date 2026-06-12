'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/lib/claude';
import MessageBubble from './MessageBubble';
import WelcomeMessage from './WelcomeMessage';

interface Props {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatWindow({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 bg-gray-50">
      {messages.length === 0 ? (
        <WelcomeMessage />
      ) : (
        <div className="mx-auto max-w-2xl">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="mr-2 mt-1 flex-none text-2xl leading-none select-none">♻️</div>
              <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-100 px-4 py-3 shadow-sm">
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
