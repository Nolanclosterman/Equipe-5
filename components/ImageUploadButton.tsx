'use client';

import { useRef } from 'react';

interface Props {
  onImageSelected: (file: File) => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

export default function ImageUploadButton({ onImageSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Format non supporté. Utilise un JPEG, PNG, GIF ou WebP !');
      return;
    }
    if (file.size > MAX_SIZE) {
      alert("L'image est trop lourde ! Maximum 5 Mo.");
      return;
    }

    onImageSelected(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Envoyer une photo"
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40"
      >
        📷
      </button>
    </>
  );
}
