import { useCallback, useState } from 'react';
import { config } from '@/shared/config/env';

export interface GenerateGreetingPayload {
  cvText: string;
  jobOfferText: string;
}

interface GenerateGreetingApiResponse {
  greeting: string;
}

type GenerateGreetingStatus = 'idle' | 'loading' | 'success' | 'error';

export function useGenerateGreeting() {
  const [status, setStatus] = useState<GenerateGreetingStatus>('idle');
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (payload: GenerateGreetingPayload) => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/cv-optimization/generate-greeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Error del servidor (${response.status})`);
      }

      const result = (await response.json()) as GenerateGreetingApiResponse;
      setData(result.greeting);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el saludo.');
      setStatus('error');
    }
  }, []);

  return { data, error, generate, isLoading: status === 'loading' };
}
