import { useEffect, useState } from 'react';
import { extractJobOfferFromActiveTab, isExtensionContext } from '@/shared/lib/chromeRuntime';
import { useGenerateGreeting } from '../hooks/useGenerateGreeting';
import { useOptimizeCv } from '../hooks/useOptimizeCv';
import { useStoredCv } from '../hooks/useStoredCv';
import { calculateAtsScore } from '../services/calculateAtsScore';
import { AtsScorePanel } from './AtsScorePanel';
import { CvStorageEditor } from './CvStorageEditor';
import { GenerateGreetingButton } from './GenerateGreetingButton';
import { GreetingResultPanel } from './GreetingResultPanel';
import { JobOfferInput } from './JobOfferInput';
import { ObservationsInput } from './ObservationsInput';
import { OptimizeButton } from './OptimizeButton';
import { OptimizedResultPanel } from './OptimizedResultPanel';

export function CvOptimizerPanel() {
  const { cvText, saveCvText, isLoaded } = useStoredCv();
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [manualJobOfferText, setManualJobOfferText] = useState('');
  const inExtension = isExtensionContext();

  const { data, error, optimize, isLoading } = useOptimizeCv();
  const [editedResult, setEditedResult] = useState<string | null>(null);
  const [scoreSnapshot, setScoreSnapshot] = useState<{ cvText: string; jobOfferText: string } | null>(
    null,
  );

  const { data: greeting, error: greetingError, generate, isLoading: isGenerating } = useGenerateGreeting();
  const [editedGreeting, setEditedGreeting] = useState<string | null>(null);

  useEffect(() => {
    if (data) setEditedResult(data);
  }, [data]);

  useEffect(() => {
    if (greeting) setEditedGreeting(greeting);
  }, [greeting]);

  const hasStoredCv = cvText.trim().length >= 50;

  const captureJobOfferText = async (): Promise<string | null> => {
    setCaptureError(null);

    if (!hasStoredCv) {
      setCaptureError('Guarda tu CV (mínimo 50 caracteres) antes de continuar.');
      return null;
    }

    if (!inExtension) {
      if (manualJobOfferText.trim().length < 30) {
        setCaptureError('Pega el texto de la oferta de empleo (mínimo 30 caracteres) antes de continuar.');
        return null;
      }
      return manualJobOfferText;
    }

    try {
      return await extractJobOfferFromActiveTab();
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Error al capturar la oferta.');
      return null;
    }
  };

  const handleOptimizeClick = async () => {
    const jobOfferText = await captureJobOfferText();
    if (!jobOfferText) return;
    setScoreSnapshot({ cvText, jobOfferText });
    await optimize({ cvText, jobOfferText, observaciones });
  };

  const handleGenerateGreetingClick = async () => {
    const jobOfferText = await captureJobOfferText();
    if (!jobOfferText) return;
    await generate({ cvText, jobOfferText });
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-4 bg-white p-4 text-gray-900">
      <header className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-base">
          🧠
        </span>
        <div>
          <h1 className="text-sm font-bold leading-tight text-gray-900">CV Optimizer</h1>
          <p className="text-[11px] text-gray-500">Adapta tu CV a la oferta con IA</p>
        </div>
      </header>

      {isLoaded && <CvStorageEditor cvText={cvText} onSave={saveCvText} />}

      {!inExtension && (
        <JobOfferInput value={manualJobOfferText} onChange={setManualJobOfferText} />
      )}

      <ObservationsInput value={observaciones} onChange={setObservaciones} />

      <div className="flex flex-col gap-2">
        <OptimizeButton onClick={handleOptimizeClick} isLoading={isLoading} disabled={!hasStoredCv} />
        <GenerateGreetingButton
          onClick={handleGenerateGreetingClick}
          isLoading={isGenerating}
          disabled={!hasStoredCv}
        />
      </div>

      {(captureError ?? error ?? greetingError) && (
        <p className="text-xs text-red-600">{captureError ?? error ?? greetingError}</p>
      )}

      {editedResult && scoreSnapshot && (
        <AtsScorePanel
          beforeScore={calculateAtsScore(scoreSnapshot.cvText, scoreSnapshot.jobOfferText).score}
          afterScore={calculateAtsScore(editedResult, scoreSnapshot.jobOfferText).score}
        />
      )}

      {editedResult && (
        <OptimizedResultPanel optimizedCvText={editedResult} onChange={setEditedResult} />
      )}

      {editedGreeting && (
        <GreetingResultPanel greetingText={editedGreeting} onChange={setEditedGreeting} />
      )}
    </div>
  );
}
