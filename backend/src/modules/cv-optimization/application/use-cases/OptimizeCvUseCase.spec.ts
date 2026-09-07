import { describe, expect, it, vi } from 'vitest';
import { OptimizeCvUseCase } from './OptimizeCvUseCase';
import { IAiService, HallucinationValidationResult } from '../../domain/ports/IAiService';
import { ICvOptimizerRepository, StoredOptimization } from '../../domain/ports/ICvOptimizerRepository';
import { IPiiMaskingService, PiiMaskingResult } from '../../domain/ports/IPiiMaskingService';

const CV_TEXT = 'a'.repeat(60);
const JOB_OFFER_TEXT = 'b'.repeat(40);

function buildAiService(overrides: Partial<IAiService> = {}): IAiService {
  return {
    optimize: vi.fn().mockResolvedValue('cv optimizado enmascarado'),
    generateGreeting: vi.fn(),
    validateNoHallucinations: vi
      .fn<IAiService['validateNoHallucinations']>()
      .mockResolvedValue({ isValid: true, issues: [], correctedText: 'cv optimizado enmascarado' }),
    ...overrides,
  };
}

function buildRepository(overrides: Partial<ICvOptimizerRepository> = {}): ICvOptimizerRepository {
  return {
    save: vi.fn().mockResolvedValue({
      id: 'stored-1',
      createdAt: new Date('2026-01-01'),
      optimizedCvText: 'cv optimizado',
    } satisfies StoredOptimization),
    findById: vi.fn(),
    ...overrides,
  };
}

function buildPiiMaskingService(overrides: Partial<IPiiMaskingService> = {}): IPiiMaskingService {
  return {
    mask: vi.fn().mockReturnValue({ maskedText: 'cv enmascarado', mapping: { '§0§': 'Juan Pérez' } } satisfies PiiMaskingResult),
    unmask: vi.fn().mockImplementation((text: string) => text.replace('cv optimizado enmascarado', 'Juan Pérez optimizado')),
    ...overrides,
  };
}

describe('OptimizeCvUseCase', () => {
  it('masks the CV before sending it to the AI service', async () => {
    const aiService = buildAiService();
    const piiMaskingService = buildPiiMaskingService();
    const useCase = new OptimizeCvUseCase(aiService, buildRepository(), piiMaskingService);

    await useCase.execute({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });

    expect(piiMaskingService.mask).toHaveBeenCalledWith(CV_TEXT);
    expect(aiService.optimize).toHaveBeenCalledWith('cv enmascarado', JOB_OFFER_TEXT, undefined);
  });

  it('forwards the optional observaciones to the AI service', async () => {
    const aiService = buildAiService();
    const useCase = new OptimizeCvUseCase(aiService, buildRepository(), buildPiiMaskingService());

    await useCase.execute({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT, observaciones: 'sin backend' });

    expect(aiService.optimize).toHaveBeenCalledWith(expect.any(String), JOB_OFFER_TEXT, 'sin backend');
  });

  it('validates the AI result for hallucinations before unmasking', async () => {
    const aiService = buildAiService();
    const piiMaskingService = buildPiiMaskingService();
    const useCase = new OptimizeCvUseCase(aiService, buildRepository(), piiMaskingService);

    await useCase.execute({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });

    expect(aiService.validateNoHallucinations).toHaveBeenCalledWith(
      'cv enmascarado',
      'cv optimizado enmascarado',
    );
  });

  it('unmasks the corrected (validated) text, not the raw AI output', async () => {
    const aiService = buildAiService({
      optimize: vi.fn().mockResolvedValue('borrador con datos inventados'),
      validateNoHallucinations: vi.fn<IAiService['validateNoHallucinations']>().mockResolvedValue({
        isValid: false,
        issues: ['agregó una certificación inexistente'],
        correctedText: 'borrador corregido',
      } satisfies HallucinationValidationResult),
    });
    const piiMaskingService = buildPiiMaskingService({
      unmask: vi.fn().mockImplementation((text: string) => `[unmasked] ${text}`),
    });
    const repository = buildRepository();
    const useCase = new OptimizeCvUseCase(aiService, repository, piiMaskingService);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await useCase.execute({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });

    expect(piiMaskingService.unmask).toHaveBeenCalledWith('borrador corregido', { '§0§': 'Juan Pérez' });
    expect(repository.save).toHaveBeenCalledWith('[unmasked] borrador corregido');
    consoleSpy.mockRestore();
  });

  it('saves the final unmasked text and returns the stored optimization', async () => {
    const repository = buildRepository({
      save: vi.fn().mockResolvedValue({
        id: 'stored-42',
        createdAt: new Date('2026-02-02'),
        optimizedCvText: 'Juan Pérez optimizado',
      }),
    });
    const useCase = new OptimizeCvUseCase(buildAiService(), repository, buildPiiMaskingService());

    const result = await useCase.execute({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });

    expect(result).toEqual({
      id: 'stored-42',
      createdAt: new Date('2026-02-02'),
      optimizedCvText: 'Juan Pérez optimizado',
    });
  });

  it('rejects a CV shorter than 50 characters without calling the AI service', async () => {
    const aiService = buildAiService();
    const useCase = new OptimizeCvUseCase(aiService, buildRepository(), buildPiiMaskingService());

    await expect(
      useCase.execute({ cvText: 'demasiado corto', jobOfferText: JOB_OFFER_TEXT }),
    ).rejects.toThrow('El texto del CV es demasiado corto para ser optimizado.');
    expect(aiService.optimize).not.toHaveBeenCalled();
  });

  it('rejects a job offer shorter than 30 characters without calling the AI service', async () => {
    const aiService = buildAiService();
    const useCase = new OptimizeCvUseCase(aiService, buildRepository(), buildPiiMaskingService());

    await expect(
      useCase.execute({ cvText: CV_TEXT, jobOfferText: 'muy corta' }),
    ).rejects.toThrow('La descripción de la oferta de empleo es demasiado corta.');
    expect(aiService.optimize).not.toHaveBeenCalled();
  });
});
