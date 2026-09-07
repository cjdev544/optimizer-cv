import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAiService } from './OpenAiService';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('openai', () => ({
  default: class FakeOpenAI {
    chat = { completions: { create: createMock } };
  },
}));

function chatResponse(content: unknown): { choices: { message: { content: string } }[] } {
  return { choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] };
}

const draftResponse = {
  name: 'Juan Pérez',
  contact: 'contacto',
  blocks: [
    {
      type: 'experience',
      heading: 'Experiencia',
      entries: [{ header: 'Puesto A', bullets: [{ text: 'Hizo A1' }] }],
    },
  ],
};

const decomposedResponse = {
  experienceBlocks: [{ entries: [{ bullets: [{ result: 'R-A1', metric: null, method: 'X-A1' }] }] }],
};

const rankingResponse = {
  blocks: [{ entryOrder: [0], bulletOrderByEntry: [[0]] }],
};

describe('OpenAiService', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  function buildService() {
    return new OpenAiService({ apiKey: 'test-key', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' });
  }

  describe('optimize', () => {
    it('assembles the final CV text from the draft, decomposition, and ranking steps', async () => {
      createMock
        .mockResolvedValueOnce(chatResponse(draftResponse))
        .mockResolvedValueOnce(chatResponse(decomposedResponse))
        .mockResolvedValueOnce(chatResponse(rankingResponse))
        .mockResolvedValueOnce(chatResponse(decomposedResponse));

      const result = await buildService().optimize('cv enmascarado', 'oferta', undefined);

      expect(createMock).toHaveBeenCalledTimes(4);
      expect(result).toContain('**Juan Pérez**');
      expect(result).toContain('- R-A1, X-A1.');
    });

    it('degrades gracefully when the bullet-decomposition step fails, keeping the draft text', async () => {
      createMock
        .mockResolvedValueOnce(chatResponse(draftResponse))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce(chatResponse(rankingResponse));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await buildService().optimize('cv enmascarado', 'oferta', undefined);

      // Draft + failed decompose + ranking = 3 calls; repair is skipped because
      // there is nothing to repair when decomposition itself failed.
      expect(createMock).toHaveBeenCalledTimes(3);
      expect(result).toContain('Hizo A1');
      consoleSpy.mockRestore();
    });

    it('degrades gracefully when the ranking step fails, keeping the original order', async () => {
      const draftWithTwoEntries = {
        ...draftResponse,
        blocks: [
          {
            type: 'experience',
            heading: 'Experiencia',
            entries: [
              { header: 'Puesto A', bullets: [{ text: 'Hizo A1' }] },
              { header: 'Puesto B', bullets: [{ text: 'Hizo B1' }] },
            ],
          },
        ],
      };
      createMock
        .mockResolvedValueOnce(chatResponse(draftWithTwoEntries))
        .mockResolvedValueOnce(
          chatResponse({
            experienceBlocks: [
              {
                entries: [
                  { bullets: [{ result: 'R-A1', metric: null, method: '' }] },
                  { bullets: [{ result: 'R-B1', metric: null, method: '' }] },
                ],
              },
            ],
          }),
        )
        .mockRejectedValueOnce(new Error('ranking service unavailable'))
        .mockResolvedValueOnce(
          chatResponse({
            experienceBlocks: [
              {
                entries: [
                  { bullets: [{ result: 'R-A1', metric: null, method: '' }] },
                  { bullets: [{ result: 'R-B1', metric: null, method: '' }] },
                ],
              },
            ],
          }),
        );
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await buildService().optimize('cv enmascarado', 'oferta', undefined);

      const puestoAIndex = result.indexOf('Puesto A');
      const puestoBIndex = result.indexOf('Puesto B');
      expect(puestoAIndex).toBeGreaterThanOrEqual(0);
      expect(puestoBIndex).toBeGreaterThan(puestoAIndex);
      consoleSpy.mockRestore();
    });

    it('throws when the draft step returns no content', async () => {
      createMock.mockResolvedValueOnce({ choices: [{ message: {} }] });

      await expect(buildService().optimize('cv', 'oferta', undefined)).rejects.toThrow(
        'El proveedor de IA no devolvió contenido.',
      );
    });
  });

  describe('generateGreeting', () => {
    it('returns the trimmed greeting text', async () => {
      createMock.mockResolvedValueOnce(chatResponse('  Hola, vi la oferta de X...  '));

      const greeting = await buildService().generateGreeting('cv', 'oferta');

      expect(greeting).toBe('Hola, vi la oferta de X...');
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    it('throws when the AI provider returns no content', async () => {
      createMock.mockResolvedValueOnce({ choices: [{ message: {} }] });

      await expect(buildService().generateGreeting('cv', 'oferta')).rejects.toThrow(
        'El proveedor de IA no devolvió contenido.',
      );
    });
  });

  describe('validateNoHallucinations', () => {
    it('returns the parsed validation result', async () => {
      createMock.mockResolvedValueOnce(
        chatResponse({ isValid: false, issues: ['certificación inventada'], correctedText: 'cv corregido' }),
      );

      const result = await buildService().validateNoHallucinations('original', 'optimizado');

      expect(result).toEqual({ isValid: false, issues: ['certificación inventada'], correctedText: 'cv corregido' });
    });

    it('falls back to the unaudited text when the response is not valid JSON', async () => {
      createMock.mockResolvedValueOnce(chatResponse('esto no es JSON'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await buildService().validateNoHallucinations('original', 'optimizado');

      expect(result).toEqual({ isValid: true, issues: [], correctedText: 'optimizado' });
      consoleSpy.mockRestore();
    });

    it('falls back to the unaudited text when the API call itself fails', async () => {
      createMock.mockRejectedValueOnce(new Error('network error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await buildService().validateNoHallucinations('original', 'optimizado');

      expect(result).toEqual({ isValid: true, issues: [], correctedText: 'optimizado' });
      consoleSpy.mockRestore();
    });
  });
});
