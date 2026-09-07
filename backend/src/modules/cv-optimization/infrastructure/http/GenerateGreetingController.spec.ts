import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { Request, Response } from 'express';
import { GenerateGreetingController } from './GenerateGreetingController';
import { GenerateGreetingUseCase } from '../../application/use-cases/GenerateGreetingUseCase';

const CV_TEXT = 'a'.repeat(60);
const JOB_OFFER_TEXT = 'b'.repeat(40);

function buildResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GenerateGreetingController', () => {
  it('parses the body, calls the use case, and responds with the greeting', async () => {
    const useCase = { execute: vi.fn().mockResolvedValue('saludo generado') } as unknown as GenerateGreetingUseCase;
    const controller = new GenerateGreetingController(useCase);
    const req = { body: { cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT } } as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.handle(req, res, next);

    expect(useCase.execute).toHaveBeenCalledWith({ cvText: CV_TEXT, jobOfferText: JOB_OFFER_TEXT });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ greeting: 'saludo generado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a ZodError to next() without calling the use case', async () => {
    const useCase = { execute: vi.fn() } as unknown as GenerateGreetingUseCase;
    const controller = new GenerateGreetingController(useCase);
    const req = { body: { cvText: CV_TEXT } } as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.handle(req, res, next);

    expect(useCase.execute).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ZodError));
  });
});
