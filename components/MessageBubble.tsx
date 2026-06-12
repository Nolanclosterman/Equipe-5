import type { Message } from '@/lib/claude';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex-none text-2xl leading-none select-none">♻️</div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'rounded-br-sm bg-green-600 text-white'
            : 'rounded-bl-sm bg-white text-gray-800 border border-gray-100'
        }`}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="ml-2 mt-1 flex-none text-2xl leading-none select-none">🧒</div>
      )}
    </div>
  );
}
