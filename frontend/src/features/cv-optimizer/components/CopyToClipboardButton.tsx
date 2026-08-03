import { useState } from 'react';

interface CopyToClipboardButtonProps {
  text: string;
}

export function CopyToClipboardButton({ text }: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
    >
      {copied ? 'Copiado ✓' : 'Copiar al portapapeles'}
    </button>
  );
}
