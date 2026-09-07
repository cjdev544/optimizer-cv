import { describe, expect, it } from 'vitest';
import { AppError } from './AppError';

describe('AppError', () => {
  it('defaults statusCode to 400', () => {
    const error = new AppError('boom');

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('boom');
    expect(error.name).toBe('AppError');
  });

  it('accepts a custom statusCode', () => {
    const error = new AppError('not found', 404);

    expect(error.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    expect(new AppError('boom')).toBeInstanceOf(Error);
  });
});
