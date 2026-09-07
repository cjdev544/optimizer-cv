import { describe, expect, it } from 'vitest';
import { JobOffer } from './JobOffer';

describe('JobOffer', () => {
  it('creates a JobOffer when the description is at least 30 characters', () => {
    const text = 'a'.repeat(30);

    const jobOffer = JobOffer.create(text);

    expect(jobOffer.getDescription()).toBe(text);
  });

  it('throws when the description is shorter than 30 characters', () => {
    expect(() => JobOffer.create('a'.repeat(29))).toThrow(
      'La descripción de la oferta de empleo es demasiado corta.',
    );
  });

  it('trims surrounding whitespace before storing the description', () => {
    const text = 'a'.repeat(30);

    const jobOffer = JobOffer.create(`  ${text}  \n`);

    expect(jobOffer.getDescription()).toBe(text);
  });
});
