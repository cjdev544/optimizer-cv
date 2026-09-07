import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useStoredCv } from './useStoredCv';
import * as storage from '@/shared/lib/storage';

vi.mock('@/shared/lib/storage');

describe('useStoredCv', () => {
  it('loads the previously stored CV text on mount', async () => {
    vi.mocked(storage.getStorageItem).mockResolvedValue('CV guardado anteriormente');

    const { result } = renderHook(() => useStoredCv());

    expect(result.current.isLoaded).toBe(false);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.cvText).toBe('CV guardado anteriormente');
  });

  it('defaults to an empty string when nothing is stored', async () => {
    vi.mocked(storage.getStorageItem).mockResolvedValue(null);

    const { result } = renderHook(() => useStoredCv());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.cvText).toBe('');
  });

  it('saveCvText persists the text and updates local state', async () => {
    vi.mocked(storage.getStorageItem).mockResolvedValue(null);
    vi.mocked(storage.setStorageItem).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStoredCv());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(() => result.current.saveCvText('Nuevo CV'));

    expect(storage.setStorageItem).toHaveBeenCalledWith('cv-optimizer:cv-text', 'Nuevo CV');
    expect(result.current.cvText).toBe('Nuevo CV');
  });
});
