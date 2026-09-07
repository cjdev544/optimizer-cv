import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { Request, Response } from 'express';
import { OptimizeCvController } from './OptimizeCvController';
import { OptimizeCvUseCase } from '../../application/use-cases/OptimizeCvUseCase';

const CV_TEXT = 'a'.repeat(60);
const JOB_OFFER_TEXT = 'b'.repeat(40);

function buildResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('OptimizeCvController', () => {
  it('parses the body, calls the use case, and responds with the serialized result', async () => {
    const useCase = {
      execute: vi.fn().mockResolvedValue({
        id: 'stored-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        optimizedCvText: 'cv optimizado',
      }),
    } as unknown as OptimizeCvUseCase;
    const controller = new OptimizeCvController(useCase);
    const req = { body: { cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT } } as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.handle(req, res, next);

    expect(useCase.execute).toHaveBeenCalledWith({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      id: 'stored-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      optimizedCvText: 'cv optimizado',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a ZodError to next() without calling the use case', async () => {
    const useCase = { execute: vi.fn() } as unknown as OptimizeCvUseCase;
    const controller = new OptimizeCvController(useCase);
    const req = { body: { cvText: 'short' } } as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.handle(req, res, next);

    expect(useCase.execute).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ZodError));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('forwards a use-case error to next()', async () => {
    const error = new Error('El proveedor de IA no devolvió contenido.');
    const useCase = { execute: vi.fn().mockRejectedValue(error) } as unknown as OptimizeCvUseCase;
    const controller = new OptimizeCvController(useCase);
    const req = { body: { cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT } } as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.handle(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
