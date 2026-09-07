import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGenerateGreeting } from './useGenerateGreeting';

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useGenerateGreeting', () => {
  it('starts with no data and not loading', () => {
    const { result } = renderHook(() => useGenerateGreeting());

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('stores the greeting returned by the API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { greeting: 'Hola, vi la oferta...' })));
    const { result } = renderHook(() => useGenerateGreeting());

    await act(() => result.current.generate({ cvText: 'cv', jobOfferText: 'oferta' }));

    expect(result.current.data).toBe('Hola, vi la oferta...');
    expect(result.current.error).toBeNull();
  });

  it('posts to the generate-greeting endpoint with the given payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { greeting: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGenerateGreeting());

    await act(() => result.current.generate({ cvText: 'mi cv', jobOfferText: 'mi oferta' }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/cv-optimization/generate-greeting'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ cvText: 'mi cv', jobOfferText: 'mi oferta' }) }),
    );
  });

  it('surfaces the server-provided error message on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { message: 'Fallo del proveedor de IA' })));
    const { result } = renderHook(() => useGenerateGreeting());

    await act(() => result.current.generate({ cvText: 'cv', jobOfferText: 'oferta' }));

    expect(result.current.error).toBe('Fallo del proveedor de IA');
    expect(result.current.data).toBeNull();
  });

  it('surfaces a network error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const { result } = renderHook(() => useGenerateGreeting());

    await act(() => result.current.generate({ cvText: 'cv', jobOfferText: 'oferta' }));

    expect(result.current.error).toBe('Failed to fetch');
  });
});
