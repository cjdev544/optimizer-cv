import { afterEach, describe, expect, it, vi } from 'vitest';

// The module registers a chrome.runtime.onMessage listener as a side effect
// of being imported, so `chrome` must exist (even as a no-op stub) before
// that import happens.
vi.stubGlobal('chrome', { runtime: { onMessage: { addListener: vi.fn() } } });

const { extractJobOfferText } = await import('./contentScript');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('extractJobOfferText', () => {
  it('returns the text of a likely job-description container when it is long enough', () => {
    document.body.innerHTML = `<div class="job-description">${'Descripción larga de la oferta. '.repeat(10)}</div>`;

    const text = extractJobOfferText();

    expect(text.length).toBeGreaterThan(200);
    expect(text).toContain('Descripción larga de la oferta.');
  });

  it('falls back to document.body.innerText when no selector matches', () => {
    document.body.innerHTML = '<div class="unrelated">short</div>';
    Object.defineProperty(document.body, 'innerText', {
      value: 'Texto completo del body como último recurso.',
      configurable: true,
    });

    const text = extractJobOfferText();

    expect(text).toBe('Texto completo del body como último recurso.');
  });

  it('ignores a matching element whose text is too short and falls back to the body', () => {
    document.body.innerHTML = '<article>muy corto</article>';
    Object.defineProperty(document.body, 'innerText', {
      value: 'Texto completo del body como último recurso.',
      configurable: true,
    });

    const text = extractJobOfferText();

    expect(text).toBe('Texto completo del body como último recurso.');
  });

  it('truncates the extracted text to 15000 characters', () => {
    document.body.innerHTML = `<main>${'a'.repeat(20000)}</main>`;

    const text = extractJobOfferText();

    expect(text).toHaveLength(15000);
  });
});
