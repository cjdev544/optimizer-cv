import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractJobOfferFromActiveTab, isExtensionContext } from './chromeRuntime';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isExtensionContext', () => {
  it('is false when there is no chrome global', () => {
    vi.stubGlobal('chrome', undefined);

    expect(isExtensionContext()).toBe(false);
  });

  it('is false when chrome.runtime.id is missing', () => {
    vi.stubGlobal('chrome', { runtime: {} });

    expect(isExtensionContext()).toBe(false);
  });

  it('is true when chrome.runtime.id is set', () => {
    vi.stubGlobal('chrome', { runtime: { id: 'extension-id' } });

    expect(isExtensionContext()).toBe(true);
  });
});

describe('extractJobOfferFromActiveTab', () => {
  it('throws when called outside of an extension context', async () => {
    vi.stubGlobal('chrome', undefined);

    await expect(extractJobOfferFromActiveTab()).rejects.toThrow(
      'La captura automática solo está disponible dentro de la extensión de Chrome.',
    );
  });

  it('throws when there is no active tab', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'extension-id' },
      tabs: { query: vi.fn().mockResolvedValue([]) },
    });

    await expect(extractJobOfferFromActiveTab()).rejects.toThrow('No se encontró una pestaña activa.');
  });

  it('throws when the content script does not return any text', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'extension-id' },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    });

    await expect(extractJobOfferFromActiveTab()).rejects.toThrow(
      'No se pudo extraer el contenido de la oferta en esta página.',
    );
  });

  it('returns the text extracted by the content script', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ text: 'Texto de la oferta' });
    vi.stubGlobal('chrome', {
      runtime: { id: 'extension-id' },
      tabs: { query: vi.fn().mockResolvedValue([{ id: 42 }]), sendMessage },
    });

    const text = await extractJobOfferFromActiveTab();

    expect(text).toBe('Texto de la oferta');
    expect(sendMessage).toHaveBeenCalledWith(42, { type: 'CV_OPTIMIZER_EXTRACT_JOB_OFFER' });
  });
});
