import { describe, expect, it } from 'vitest';
import { InMemoryCvOptimizerRepository } from './InMemoryCvOptimizerRepository';

describe('InMemoryCvOptimizerRepository', () => {
  it('save assigns an id and createdAt, and stores the text', async () => {
    const repository = new InMemoryCvOptimizerRepository();

    const stored = await repository.save('cv optimizado');

    expect(stored.id).toEqual(expect.any(String));
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(stored.optimizedCvText).toBe('cv optimizado');
  });

  it('findById returns a previously saved optimization', async () => {
    const repository = new InMemoryCvOptimizerRepository();
    const stored = await repository.save('cv optimizado');

    const found = await repository.findById(stored.id);

    expect(found).toEqual(stored);
  });

  it('findById returns null for an unknown id', async () => {
    const repository = new InMemoryCvOptimizerRepository();

    expect(await repository.findById('does-not-exist')).toBeNull();
  });

  it('save generates a different id for each call', async () => {
    const repository = new InMemoryCvOptimizerRepository();

    const first = await repository.save('cv 1');
    const second = await repository.save('cv 2');

    expect(first.id).not.toBe(second.id);
  });
});
