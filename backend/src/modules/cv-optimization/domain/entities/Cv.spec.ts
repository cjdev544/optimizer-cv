import { describe, expect, it } from 'vitest';
import { Cv } from './Cv';

describe('Cv', () => {
  it('creates a Cv when the text is at least 50 characters', () => {
    const text = 'a'.repeat(50);

    const cv = Cv.create(text);

    expect(cv.getText()).toBe(text);
  });

  it('throws when the text is shorter than 50 characters', () => {
    expect(() => Cv.create('a'.repeat(49))).toThrow(
      'El texto del CV es demasiado corto para ser optimizado.',
    );
  });

  it('trims surrounding whitespace before storing the text', () => {
    const text = 'a'.repeat(50);

    const cv = Cv.create(`  ${text}  \n`);

    expect(cv.getText()).toBe(text);
  });

  it('validates length using the trimmed text, not the raw input', () => {
    // 50 raw characters, but only 48 once the surrounding whitespace is trimmed.
    const raw = `  ${'a'.repeat(48)}  `;
    expect(raw).toHaveLength(52);

    expect(() => Cv.create(raw)).toThrow('El texto del CV es demasiado corto para ser optimizado.');
  });
});
