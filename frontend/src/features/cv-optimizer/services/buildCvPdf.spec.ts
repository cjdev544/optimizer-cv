import { describe, expect, it } from 'vitest';
import { buildCvFileName, buildCvPdf } from './buildCvPdf';

describe('buildCvFileName', () => {
  it('slugifies the first non-empty line of the CV', () => {
    expect(buildCvFileName('Juan Pérez\nResto del CV')).toBe('Juan-Perez-optimizado.pdf');
  });

  it('skips leading blank lines to find the first real line', () => {
    expect(buildCvFileName('\n\nAna García\nResto')).toBe('Ana-Garcia-optimizado.pdf');
  });

  it('collapses non-alphanumeric characters into a single dash', () => {
    expect(buildCvFileName('Juan  ***  Pérez!!\nResto')).toBe('Juan-Perez-optimizado.pdf');
  });

  it('falls back to "CV" when the text has no usable characters', () => {
    expect(buildCvFileName('   \n   \n')).toBe('CV-optimizado.pdf');
  });

  it('falls back to "CV" when the first line has no alphanumeric characters', () => {
    expect(buildCvFileName('***\nResto')).toBe('CV-optimizado.pdf');
  });
});

describe('buildCvPdf', () => {
  it('returns a jsPDF document without throwing for a typical structured CV', async () => {
    const cvText = [
      '**Juan Pérez**',
      'Madrid · juan@example.com',
      '',
      '**Resumen**',
      'Desarrollador backend con experiencia en Node.js.',
      '',
      '**Experiencia**',
      '**Backend Engineer, Acme**',
      '- Reduje el tiempo de build en un 40%, usando esbuild.',
      '- Diseñé una arquitectura hexagonal para el módulo de pagos.',
    ].join('\n');

    const doc = await buildCvPdf(cvText);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('adds extra pages when the content overflows a single page', async () => {
    const manyBullets = Array.from({ length: 120 }, (_, i) => `- Logro número ${i} con una descripción larga.`);
    const cvText = ['**Juan Pérez**', 'contacto', '', '**Experiencia**', '**Puesto**', ...manyBullets].join('\n');

    const doc = await buildCvPdf(cvText);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('does not throw for an empty CV text', async () => {
    await expect(buildCvPdf('')).resolves.toBeDefined();
  });
});
