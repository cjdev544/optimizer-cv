import { describe, expect, it } from 'vitest';
import { calculateAtsScore } from './calculateAtsScore';

describe('calculateAtsScore', () => {
  it('returns a score of 0 when the job offer has no meaningful keywords', () => {
    const result = calculateAtsScore('cualquier CV', 'de la el en y a');

    expect(result).toEqual({ score: 0, matchedKeywords: [], totalKeywords: 0 });
  });

  it('scores 100 when every keyword from the offer appears in the CV', () => {
    const result = calculateAtsScore(
      'Experiencia con react y typescript en proyectos de backend.',
      'react y typescript',
    );

    expect(result.score).toBe(100);
    expect(result.totalKeywords).toBe(2);
    expect(result.matchedKeywords.sort()).toEqual(['react', 'typescript'].sort());
  });

  it('scores partially when only some keywords match', () => {
    const result = calculateAtsScore('Experiencia con react.', 'Buscamos react, kubernetes y aws.');

    expect(result.totalKeywords).toBe(3);
    expect(result.matchedKeywords).toEqual(['react']);
    expect(result.score).toBe(Math.round((1 / 3) * 100));
  });

  it('ignores common Spanish and English stopwords', () => {
    // Every word here other than "react" is on the stopword list (or under 3
    // characters), so it must be the only extracted keyword.
    const result = calculateAtsScore('react', 'This is the job for you and your team with react experience');

    expect(result.matchedKeywords).toEqual(['react']);
    expect(result.totalKeywords).toBe(1);
  });

  it('matches keywords regardless of accents or case', () => {
    const result = calculateAtsScore(
      'Experiencia en programación y gestión de bases de datos.',
      'con PROGRAMACIÓN y GESTIÓN',
    );

    expect(result.totalKeywords).toBe(2);
    expect(result.matchedKeywords.sort()).toEqual(['gestion', 'programacion'].sort());
    expect(result.score).toBe(100);
  });

  it('keeps dotted technology names such as "node.js" as a single keyword', () => {
    const result = calculateAtsScore('Experiencia con Node.js en el backend.', 'Requiere experiencia con Node.js.');

    expect(result.matchedKeywords).toContain('node.js');
  });

  it('does not attach a trailing sentence period to the last word of a keyword', () => {
    const result = calculateAtsScore(
      'Dominio de TypeScript en proyectos grandes.',
      'Buscamos dominio de TypeScript.',
    );

    expect(result.matchedKeywords).toContain('typescript');
    expect(result.matchedKeywords).not.toContain('typescript.');
  });

  it('deduplicates repeated keywords from the offer', () => {
    const result = calculateAtsScore('react', 'react react react react');

    expect(result.totalKeywords).toBe(1);
  });

  it('scores 0 when the offer has real keywords but none of them appear in the CV', () => {
    const result = calculateAtsScore('Sin ninguna tecnología relevante mencionada aquí.', 'con aws');

    expect(result.totalKeywords).toBe(1);
    expect(result.matchedKeywords).toEqual([]);
    expect(result.score).toBe(0);
  });
});
