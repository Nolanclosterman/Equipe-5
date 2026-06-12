import ReactMarkdown from 'react-markdown';
import type { Message } from '@/lib/claude';
import { detectBins } from '@/lib/bins';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const bins = isUser ? [] : detectBins(message.content);

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <img
          src="/trico-avatar.png"
          alt="Trico"
          className="mr-2 mt-1 h-8 w-8 flex-none rounded-full object-cover select-none"
        />
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'rounded-br-sm bg-green-600 text-white'
            : 'rounded-bl-sm bg-gray-100 text-gray-800'
        }`}
        style={{ wordBreak: 'break-word' }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <>
            {bins.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {bins.map((bin) => (
                  <span
                    key={bin.id}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${bin.className}`}
                  >
                    <span className="text-sm leading-none">{bin.emoji}</span>
                    {bin.label}
                  </span>
                ))}
              </div>
            )}
            <ReactMarkdown
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-green-700 hover:text-green-900 break-all"
                >
                  {children}
                </a>
              ),
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
            }}
            >
              {message.content}
            </ReactMarkdown>
          </>
        )}
      </div>
      {isUser && (
        <div className="ml-2 mt-1 flex-none text-2xl leading-none select-none">🧒</div>
      )}
    </div>
  );
}
