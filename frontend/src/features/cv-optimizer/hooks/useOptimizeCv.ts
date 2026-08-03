import { useCallback, useState } from 'react';
import { config } from '@/shared/config/env';

export interface OptimizeCvPayload {
  cvText: string;
  jobOfferText: string;
  observaciones?: string;
}

interface OptimizeCvApiResponse {
  id: string;
  createdAt: string;
  optimizedCvText: string;
}

type OptimizeCvStatus = 'idle' | 'loading' | 'success' | 'error';

export function useOptimizeCv() {
  const [status, setStatus] = useState<OptimizeCvStatus>('idle');
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(async (payload: OptimizeCvPayload) => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/cv-optimization/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Error del servidor (${response.status})`);
      }

      const result = (await response.json()) as OptimizeCvApiResponse;
      setData(result.optimizedCvText);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al optimizar el CV.');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  return { status, data, error, optimize, reset, isLoading: status === 'loading' };
}
