import { describe, expect, it, vi } from 'vitest';
import { GenerateGreetingUseCase } from './GenerateGreetingUseCase';
import { IAiService } from '../../domain/ports/IAiService';
import { IPiiMaskingService } from '../../domain/ports/IPiiMaskingService';

const CV_TEXT = 'a'.repeat(60);
const JOB_OFFER_TEXT = 'b'.repeat(40);

function buildAiService(overrides: Partial<IAiService> = {}): IAiService {
  return {
    optimize: vi.fn(),
    generateGreeting: vi.fn().mockResolvedValue('saludo enmascarado §0§'),
    validateNoHallucinations: vi.fn(),
    ...overrides,
  };
}

function buildPiiMaskingService(overrides: Partial<IPiiMaskingService> = {}): IPiiMaskingService {
  return {
    mask: vi.fn().mockReturnValue({ maskedText: 'cv enmascarado', mapping: { '§0§': 'Juan Pérez' } }),
    unmask: vi.fn().mockImplementation((text: string) => text.replace('§0§', 'Juan Pérez')),
    ...overrides,
  };
}

describe('GenerateGreetingUseCase', () => {
  it('masks the CV before generating the greeting', async () => {
    const aiService = buildAiService();
    const piiMaskingService = buildPiiMaskingService();
    const useCase = new GenerateGreetingUseCase(aiService, piiMaskingService);

    await useCase.execute({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });

    expect(piiMaskingService.mask).toHaveBeenCalledWith(CV_TEXT);
    expect(aiService.generateGreeting).toHaveBeenCalledWith('cv enmascarado', JOB_OFFER_TEXT);
  });

  it('unmasks the greeting returned by the AI service', async () => {
    const useCase = new GenerateGreetingUseCase(buildAiService(), buildPiiMaskingService());

    const greeting = await useCase.execute({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });

    expect(greeting).toBe('saludo enmascarado Juan Pérez');
  });

  it('rejects a CV shorter than 50 characters without calling the AI service', async () => {
    const aiService = buildAiService();
    const useCase = new GenerateGreetingUseCase(aiService, buildPiiMaskingService());

    await expect(
      useCase.execute({ cvText: 'corto', jobOfferText: JOB_OFFER_TEXT }),
    ).rejects.toThrow('El texto del CV es demasiado corto para ser optimizado.');
    expect(aiService.generateGreeting).not.toHaveBeenCalled();
  });

  it('rejects a job offer shorter than 30 characters without calling the AI service', async () => {
    const aiService = buildAiService();
    const useCase = new GenerateGreetingUseCase(aiService, buildPiiMaskingService());

    await expect(
      useCase.execute({ cvText: CV_TEXT, jobOfferText: 'corta' }),
    ).rejects.toThrow('La descripción de la oferta de empleo es demasiado corta.');
    expect(aiService.generateGreeting).not.toHaveBeenCalled();
  });
});
