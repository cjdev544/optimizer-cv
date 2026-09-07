import { describe, expect, it } from 'vitest';
import {
  assembleStructuredCv,
  capitalizeFirst,
  DecomposedBulletsResponse,
  DraftCvResponse,
  DraftExperienceEntry,
  isPermutationOf,
  isSameShape,
  isValidRankedBlock,
  RankedBlock,
  RankingResponse,
  renderStructuredCv,
  stripTrailingPunctuation,
  StructuredCvResponse,
} from './OpenAiService';

describe('isPermutationOf', () => {
  it('accepts a valid permutation of the expected length', () => {
    expect(isPermutationOf([2, 0, 1], 3)).toBe(true);
  });

  it('accepts the identity permutation', () => {
    expect(isPermutationOf([0, 1, 2], 3)).toBe(true);
  });

  it('rejects a candidate with the wrong length', () => {
    expect(isPermutationOf([0, 1], 3)).toBe(false);
  });

  it('rejects a candidate with a duplicate index', () => {
    expect(isPermutationOf([0, 0, 2], 3)).toBe(false);
  });

  it('rejects a candidate with an out-of-range index', () => {
    expect(isPermutationOf([0, 1, 5], 3)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isPermutationOf(undefined, 3)).toBe(false);
  });

  it('accepts an empty permutation for length 0', () => {
    expect(isPermutationOf([], 0)).toBe(true);
  });
});

function buildEntries(bulletCounts: number[]): DraftExperienceEntry[] {
  return bulletCounts.map((count, entryIndex) => ({
    header: `Entry ${entryIndex}`,
    bullets: Array.from({ length: count }, (_, bulletIndex) => ({ text: `Bullet ${entryIndex}.${bulletIndex}` })),
  }));
}

describe('isValidRankedBlock', () => {
  it('accepts a ranked block that is a full, valid permutation of the entries and their bullets', () => {
    const entries = buildEntries([2, 1]);
    const ranked: RankedBlock = { entryOrder: [1, 0], bulletOrderByEntry: [[1, 0], [0]] };

    expect(isValidRankedBlock(ranked, entries)).toBe(true);
  });

  it('rejects undefined', () => {
    expect(isValidRankedBlock(undefined, buildEntries([2]))).toBe(false);
  });

  it('rejects a block whose entryOrder is not a permutation of the entries', () => {
    const entries = buildEntries([2, 1]);
    const ranked: RankedBlock = { entryOrder: [0, 0], bulletOrderByEntry: [[0, 1], [0]] };

    expect(isValidRankedBlock(ranked, entries)).toBe(false);
  });

  it('rejects a block with fewer bulletOrderByEntry entries than entries', () => {
    const entries = buildEntries([2, 1]);
    const ranked: RankedBlock = { entryOrder: [0, 1], bulletOrderByEntry: [[0, 1]] };

    expect(isValidRankedBlock(ranked, entries)).toBe(false);
  });

  it('rejects a block where one entry bullet order is not a valid permutation', () => {
    const entries = buildEntries([2, 1]);
    const ranked: RankedBlock = { entryOrder: [0, 1], bulletOrderByEntry: [[0, 5], [0]] };

    expect(isValidRankedBlock(ranked, entries)).toBe(false);
  });
});

describe('isSameShape', () => {
  function response(blocks: number[][]): DecomposedBulletsResponse {
    return {
      experienceBlocks: blocks.map((bulletsPerEntry) => ({
        entries: bulletsPerEntry.map((count) => ({
          bullets: Array.from({ length: count }, () => ({ result: 'r', metric: null, method: 'm' })),
        })),
      })),
    };
  }

  it('is true for two identically-shaped responses', () => {
    expect(isSameShape(response([[2, 1]]), response([[2, 1]]))).toBe(true);
  });

  it('is false when the number of blocks differs', () => {
    expect(isSameShape(response([[2]]), response([[2], [1]]))).toBe(false);
  });

  it('is false when the number of entries in a block differs', () => {
    expect(isSameShape(response([[2, 1]]), response([[2]]))).toBe(false);
  });

  it('is false when the number of bullets in an entry differs', () => {
    expect(isSameShape(response([[2]]), response([[3]]))).toBe(false);
  });
});

describe('stripTrailingPunctuation', () => {
  it('removes a trailing period', () => {
    expect(stripTrailingPunctuation('Reduje el tiempo de build.')).toBe('Reduje el tiempo de build');
  });

  it('removes trailing whitespace and multiple trailing periods', () => {
    expect(stripTrailingPunctuation('Reduje el tiempo de build...  ')).toBe('Reduje el tiempo de build');
  });

  it('trims leading whitespace too', () => {
    expect(stripTrailingPunctuation('  con Docker')).toBe('con Docker');
  });

  it('leaves internal punctuation untouched', () => {
    expect(stripTrailingPunctuation('usando Docker, Kubernetes y CI/CD.')).toBe('usando Docker, Kubernetes y CI/CD');
  });
});

describe('capitalizeFirst', () => {
  it('capitalizes the first letter', () => {
    expect(capitalizeFirst('evité duplicar lógica')).toBe('Evité duplicar lógica');
  });

  it('leaves an already-capitalized string unchanged', () => {
    expect(capitalizeFirst('Evité duplicar lógica')).toBe('Evité duplicar lógica');
  });

  it('returns an empty string unchanged', () => {
    expect(capitalizeFirst('')).toBe('');
  });
});

describe('renderStructuredCv', () => {
  it('renders the name, contact line, and each block heading', () => {
    const cv: StructuredCvResponse = {
      name: 'Juan Pérez',
      contact: 'Madrid, España · juan@example.com',
      blocks: [{ type: 'text', heading: 'Resumen', content: 'Desarrollador backend.' }],
    };

    const text = renderStructuredCv(cv);

    expect(text).toContain('**Juan Pérez**');
    expect(text).toContain('Madrid, España · juan@example.com');
    expect(text).toContain('**Resumen**');
    expect(text).toContain('Desarrollador backend.');
  });

  it('joins result, metric, and method into one sentence per bullet', () => {
    const cv: StructuredCvResponse = {
      name: 'Juan Pérez',
      contact: 'contacto',
      blocks: [
        {
          type: 'experience',
          heading: 'Experiencia',
          entries: [
            {
              header: 'Backend Engineer, Acme',
              bullets: [
                { result: 'evité duplicar lógica', metric: 'en 2 plataformas', method: 'con React' },
              ],
            },
          ],
        },
      ],
    };

    const text = renderStructuredCv(cv);

    expect(text).toContain('- Evité duplicar lógica, en 2 plataformas, con React.');
  });

  it('omits the metric clause when it is null', () => {
    const cv: StructuredCvResponse = {
      name: 'Juan Pérez',
      contact: 'contacto',
      blocks: [
        {
          type: 'experience',
          heading: 'Experiencia',
          entries: [
            {
              header: 'Backend Engineer, Acme',
              bullets: [{ result: 'reduje el tiempo de build', metric: null, method: 'con esbuild' }],
            },
          ],
        },
      ],
    };

    const text = renderStructuredCv(cv);

    expect(text).toContain('- Reduje el tiempo de build, con esbuild.');
    expect(text).not.toContain('null');
  });

  it('renders multiple entries with a blank line between them', () => {
    const cv: StructuredCvResponse = {
      name: 'Juan Pérez',
      contact: 'contacto',
      blocks: [
        {
          type: 'experience',
          heading: 'Experiencia',
          entries: [
            { header: 'Puesto A', bullets: [{ result: 'logro A', metric: null, method: '' }] },
            { header: 'Puesto B', bullets: [{ result: 'logro B', metric: null, method: '' }] },
          ],
        },
      ],
    };

    const text = renderStructuredCv(cv);
    const puestoAIndex = text.indexOf('**Puesto A**');
    const puestoBIndex = text.indexOf('**Puesto B**');

    expect(puestoAIndex).toBeGreaterThanOrEqual(0);
    expect(puestoBIndex).toBeGreaterThan(puestoAIndex);
  });
});

describe('assembleStructuredCv', () => {
  function draftWithOneExperienceBlock(): DraftCvResponse {
    return {
      name: 'Juan Pérez',
      contact: 'contacto',
      blocks: [
        {
          type: 'experience',
          heading: 'Experiencia',
          entries: [
            { header: 'Puesto A', bullets: [{ text: 'Hizo A1' }, { text: 'Hizo A2' }] },
            { header: 'Puesto B', bullets: [{ text: 'Hizo B1' }] },
          ],
        },
      ],
    };
  }

  it('passes text blocks through unchanged', () => {
    const draft: DraftCvResponse = {
      name: 'Juan Pérez',
      contact: 'contacto',
      blocks: [{ type: 'text', heading: 'Resumen', content: 'Desarrollador backend.' }],
    };

    const result = assembleStructuredCv(draft, null, null);

    expect(result.blocks).toEqual([{ type: 'text', heading: 'Resumen', content: 'Desarrollador backend.' }]);
  });

  it('falls back to the draft bullet text when there is no decomposition', () => {
    const draft = draftWithOneExperienceBlock();

    const result = assembleStructuredCv(draft, null, null);

    expect(result.blocks[0]).toMatchObject({
      type: 'experience',
      entries: [
        { header: 'Puesto A', bullets: [{ result: 'Hizo A1', metric: null, method: '' }, { result: 'Hizo A2', metric: null, method: '' }] },
        { header: 'Puesto B', bullets: [{ result: 'Hizo B1', metric: null, method: '' }] },
      ],
    });
  });

  it('merges the decomposed result/metric/method fields by position when shapes match', () => {
    const draft = draftWithOneExperienceBlock();
    const decomposed: DecomposedBulletsResponse = {
      experienceBlocks: [
        {
          entries: [
            {
              bullets: [
                { result: 'R-A1', metric: 'M-A1', method: 'X-A1' },
                { result: 'R-A2', metric: null, method: 'X-A2' },
              ],
            },
            { bullets: [{ result: 'R-B1', metric: null, method: 'X-B1' }] },
          ],
        },
      ],
    };

    const result = assembleStructuredCv(draft, decomposed, null);

    expect(result.blocks[0]).toMatchObject({
      entries: [
        {
          bullets: [
            { result: 'R-A1', metric: 'M-A1', method: 'X-A1' },
            { result: 'R-A2', metric: null, method: 'X-A2' },
          ],
        },
        { bullets: [{ result: 'R-B1', metric: null, method: 'X-B1' }] },
      ],
    });
  });

  it('falls back to the draft text for a single bullet missing from an otherwise-present decomposition', () => {
    const draft = draftWithOneExperienceBlock();
    // Only the first entry's first bullet has a decomposition; everything else
    // (the second bullet of that entry, and the whole second entry) is missing.
    const decomposed: DecomposedBulletsResponse = {
      experienceBlocks: [
        { entries: [{ bullets: [{ result: 'R-A1', metric: null, method: 'X-A1' }] }] },
      ],
    };

    const result = assembleStructuredCv(draft, decomposed, null);

    const entries = (result.blocks[0] as { entries: { bullets: { result: string }[] }[] }).entries;
    expect(entries[0]?.bullets[0]?.result).toBe('R-A1');
    expect(entries[0]?.bullets[1]?.result).toBe('Hizo A2');
    expect(entries[1]?.bullets[0]?.result).toBe('Hizo B1');
  });

  it('keeps the original order when there is no ranking', () => {
    const draft = draftWithOneExperienceBlock();

    const result = assembleStructuredCv(draft, null, null);

    const entries = (result.blocks[0] as { entries: { header: string }[] }).entries;
    expect(entries.map((e) => e.header)).toEqual(['Puesto A', 'Puesto B']);
  });

  it('reorders entries and bullets when the ranking is a valid permutation', () => {
    const draft = draftWithOneExperienceBlock();
    const ranking: RankingResponse = {
      blocks: [{ entryOrder: [1, 0], bulletOrderByEntry: [[1, 0], [0]] }],
    };

    const result = assembleStructuredCv(draft, null, ranking);

    const entries = (result.blocks[0] as { entries: { header: string; bullets: { result: string }[] }[] }).entries;
    expect(entries.map((e) => e.header)).toEqual(['Puesto B', 'Puesto A']);
    expect(entries[1]?.bullets.map((b) => b.result)).toEqual(['Hizo A2', 'Hizo A1']);
  });

  it('keeps the original order for a block whose ranking is not a valid permutation', () => {
    const draft = draftWithOneExperienceBlock();
    const invalidRanking: RankingResponse = {
      blocks: [{ entryOrder: [0, 0], bulletOrderByEntry: [[0, 1], [0]] }],
    };

    const result = assembleStructuredCv(draft, null, invalidRanking);

    const entries = (result.blocks[0] as { entries: { header: string }[] }).entries;
    expect(entries.map((e) => e.header)).toEqual(['Puesto A', 'Puesto B']);
  });
});
