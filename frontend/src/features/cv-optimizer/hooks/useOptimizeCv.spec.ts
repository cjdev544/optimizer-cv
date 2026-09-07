import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOptimizeCv } from './useOptimizeCv';

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOptimizeCv', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useOptimizeCv());

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets status to loading while the request is in flight', async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );
    const { result } = renderHook(() => useOptimizeCv());

    act(() => {
      void result.current.optimize({ cvText: 'cv', jobOfferText: 'oferta' });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    resolveFetch(jsonResponse(200, { id: '1', createdAt: '2026-01-01', optimizedCvText: 'cv optimizado' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('stores the optimized text and sets status to success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { id: '1', createdAt: '2026-01-01', optimizedCvText: 'cv optimizado' })),
    );
    const { result } = renderHook(() => useOptimizeCv());

    await act(() => result.current.optimize({ cvText: 'cv', jobOfferText: 'oferta' }));

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('cv optimizado');
    expect(result.current.error).toBeNull();
  });

  it('posts to the optimize endpoint with the given payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: '1', createdAt: '', optimizedCvText: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOptimizeCv());

    await act(() => result.current.optimize({ cvText: 'mi cv', jobOfferText: 'mi oferta', observaciones: 'nota' }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/cv-optimization/optimize'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvText: 'mi cv', jobOfferText: 'mi oferta', observaciones: 'nota' }),
      }),
    );
  });

  it('surfaces the server-provided error message on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, { message: 'CV demasiado corto' })));
    const { result } = renderHook(() => useOptimizeCv());

    await act(() => result.current.optimize({ cvText: 'cv', jobOfferText: 'oferta' }));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('CV demasiado corto');
    expect(result.current.data).toBeNull();
  });

  it('falls back to a generic error message when the response has no JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error('no body')) }));
    const { result } = renderHook(() => useOptimizeCv());

    await act(() => result.current.optimize({ cvText: 'cv', jobOfferText: 'oferta' }));

    expect(result.current.error).toBe('Error del servidor (500)');
  });

  it('surfaces a network error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const { result } = renderHook(() => useOptimizeCv());

    await act(() => result.current.optimize({ cvText: 'cv', jobOfferText: 'oferta' }));

    expect(result.current.error).toBe('Failed to fetch');
  });

  it('reset returns the hook to its idle state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { id: '1', createdAt: '', optimizedCvText: 'x' })));
    const { result } = renderHook(() => useOptimizeCv());
    await act(() => result.current.optimize({ cvText: 'cv', jobOfferText: 'oferta' }));

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
