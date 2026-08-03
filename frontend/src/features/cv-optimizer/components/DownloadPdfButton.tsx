import { useState } from 'react';
import { buildCvFileName, buildCvPdf } from '../services/buildCvPdf';

interface DownloadPdfButtonProps {
  cvText: string;
}

export function DownloadPdfButton({ cvText }: DownloadPdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const doc = await buildCvPdf(cvText);
      doc.save(buildCvFileName(cvText));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isGenerating}
      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
    >
      {isGenerating ? 'Generando…' : 'Descargar PDF'}
    </button>
  );
}
