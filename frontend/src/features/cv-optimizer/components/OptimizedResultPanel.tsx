import { CopyToClipboardButton } from './CopyToClipboardButton';
import { DownloadPdfButton } from './DownloadPdfButton';

interface OptimizedResultPanelProps {
  optimizedCvText: string;
  onChange: (text: string) => void;
}

export function OptimizedResultPanel({ optimizedCvText, onChange }: OptimizedResultPanelProps) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800">CV Optimizado</h2>
        <div className="flex items-center gap-1.5">
          <CopyToClipboardButton text={optimizedCvText} />
          <DownloadPdfButton cvText={optimizedCvText} />
        </div>
      </div>
      <textarea
        value={optimizedCvText}
        onChange={(event) => onChange(event.target.value)}
        className="h-48 w-full resize-none rounded-md border border-gray-200 bg-white p-2 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <p className="text-[10px] text-gray-400">
        Podés editar el texto antes de copiarlo o descargarlo.
      </p>
    </section>
  );
}
