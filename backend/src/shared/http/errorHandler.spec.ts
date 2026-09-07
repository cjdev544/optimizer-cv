import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Request, Response } from 'express';
import { errorHandler } from './errorHandler';
import { AppError } from '../errors/AppError';

function buildResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('maps a ZodError to 400 with the failing issues', () => {
    const res = buildResponse();
    const schema = z.object({ cvText: z.string().min(50) });
    const zodError = schema.safeParse({ cvText: 'short' }).error!;

    errorHandler(zodError, {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(payload.error).toBe('ValidationError');
    expect(payload.issues).toEqual([{ path: ['cvText'], message: expect.any(String) }]);
  });

  it('maps an AppError to its own statusCode', () => {
    const res = buildResponse();

    errorHandler(new AppError('El texto del CV es demasiado corto.', 422), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: 'AppError',
      message: 'El texto del CV es demasiado corto.',
    });
  });

  it('falls back to 500 for an unknown Error, including its message', () => {
    // Documents current behavior: unlike a typical "generic message" 500
    // handler, this one forwards the raw error message to the client.
    const res = buildResponse();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(new Error('conexión rechazada por el proveedor de IA'), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'InternalServerError',
      message: 'conexión rechazada por el proveedor de IA',
    });
    consoleSpy.mockRestore();
  });

  it('falls back to a generic message for a non-Error thrown value', () => {
    const res = buildResponse();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler('just a string', {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'InternalServerError',
      message: 'Error interno del servidor',
    });
    consoleSpy.mockRestore();
  });
});
