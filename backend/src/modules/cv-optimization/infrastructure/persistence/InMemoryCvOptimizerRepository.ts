import { randomUUID } from 'node:crypto';
import { ICvOptimizerRepository, StoredOptimization } from '../../domain/ports/ICvOptimizerRepository';

export class InMemoryCvOptimizerRepository implements ICvOptimizerRepository {
  private readonly store = new Map<string, StoredOptimization>();

  async save(optimizedCvText: string): Promise<StoredOptimization> {
    const stored: StoredOptimization = {
      id: randomUUID(),
      createdAt: new Date(),
      optimizedCvText,
    };
    this.store.set(stored.id, stored);
    return stored;
  }

  async findById(id: string): Promise<StoredOptimization | null> {
    return this.store.get(id) ?? null;
  }
}
