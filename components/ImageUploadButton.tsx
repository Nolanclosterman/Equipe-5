'use client';

interface Props {
  onImageSelected: (file: File) => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

export default function ImageUploadButton({ onImageSelected, disabled }: Props) {
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
    e.target.value = '';
  };

  return (
    <label
      aria-label="Envoyer une photo"
      className={`flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:bg-gray-200 cursor-pointer'
      }`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
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
