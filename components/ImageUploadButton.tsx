'use client';

interface Props {
  onImageSelected: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const MAX_SIZE = 5 * 1024 * 1024;

export default function ImageUploadButton({ onImageSelected, onError, disabled }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      onError?.("Cette image est un peu trop lourde pour moi ! 😅 Essaie une photo de moins de 5 Mo.");
      e.target.value = '';
      return;
    }

    onImageSelected(file);
    e.target.value = '';
  };

  return (
    <label
      aria-label="Envoyer une photo"
      title="Envoyer une photo"
      className={`flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:bg-blue-100 cursor-pointer'
      }`}
    >
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </label>
  );
}
