'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Props {
  onClose: () => void;
}

type Status = 'starting' | 'ready' | 'scanning' | 'result' | 'denied' | 'error';

interface ScanResult {
  wasteName?: string;
  reply: string;
  identified: boolean;
}

// Live-camera "AR" scan: shows the rear camera full screen; on tap, grabs the
// current frame and sends it to the existing vision endpoint (/api/image), then
// overlays a bubble with the waste + where to throw it — same info as the chat.
export default function LiveScanModal({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Acquire the camera on mount, release every track on unmount.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg("Ton navigateur ne permet pas d'ouvrir la caméra. 😕");
        setStatus('error');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('ready');
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('denied');
        } else {
          setErrorMsg("Je n'arrive pas à ouvrir la caméra. 😕 Réessaie ou vérifie les autorisations.");
          setStatus('error');
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const scan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setStatus('scanning');
    setResult(null);

    // Downscale the frame to keep the upload small (≤ ~1024px, JPEG).
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('ready');
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );
    if (!blob) {
      setStatus('ready');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', new File([blob], 'scan.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/image', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.status === 429) {
        setResult({ identified: false, reply: 'Doucement ! 😄 Attends quelques secondes avant de re-scanner.' });
      } else if (!res.ok) {
        setResult({ identified: false, reply: data.error ?? "Oups, je n'ai pas réussi à analyser. Réessaie !" });
      } else {
        setResult({
          identified: Boolean(data.wasteName),
          wasteName: data.wasteName,
          reply: data.reply ?? '',
        });
      }
      setStatus('result');
    } catch {
      setResult({ identified: false, reply: 'Pas de connexion. Vérifie ton internet et réessaie ! 🌐' });
      setStatus('result');
    }
  }, []);

  const rescan = () => {
    setResult(null);
    setStatus('ready');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
        <span className="flex items-center gap-2 font-bold text-white drop-shadow">
          <span className="text-xl">📷</span> Scan en direct
        </span>
        <button
          onClick={onClose}
          aria-label="Fermer le scan"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        >
          ✕
        </button>
      </div>

      {/* Reticle hint while aiming */}
      {(status === 'ready' || status === 'scanning') && !result && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div className="h-48 w-48 rounded-3xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.15)]" />
        </div>
      )}

      {/* Permission / error states */}
      {(status === 'denied' || status === 'error') && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center text-white">
          <div className="text-5xl">📵</div>
          <p className="text-base leading-relaxed">
            {status === 'denied'
              ? "J'ai besoin de l'autorisation d'accéder à ta caméra pour scanner. 🙏 Autorise-la dans les réglages de ton navigateur, puis réessaie !"
              : errorMsg}
          </p>
          <button onClick={onClose} className="mt-2 rounded-full bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700">
            Retour au chat
          </button>
        </div>
      )}

      {/* Result bubble */}
      {result && (
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-28">
          <div className="mx-auto max-w-md rounded-3xl bg-white/95 p-4 shadow-2xl backdrop-blur">
            {result.identified && result.wasteName && (
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xl">♻️</span>
                <h3 className="text-lg font-extrabold text-green-700">{result.wasteName}</h3>
              </div>
            )}
            <div className="max-h-44 overflow-y-auto text-sm leading-relaxed text-gray-800">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-green-700">{children}</strong>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">
                      {children}
                    </a>
                  ),
                }}
              >
                {result.reply}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-black/60 to-transparent pb-8 pt-6">
        {status === 'result' ? (
          <button
            onClick={rescan}
            className="rounded-full bg-green-600 px-8 py-3 font-bold text-white shadow-lg transition-colors hover:bg-green-700"
          >
            Scanner à nouveau 🔄
          </button>
        ) : (
          <button
            onClick={scan}
            disabled={status !== 'ready'}
            aria-label="Scanner l'objet"
            className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white bg-green-600 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            style={{ height: '4.5rem', width: '4.5rem' }}
          >
            {status === 'scanning' ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="text-3xl">🔍</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
