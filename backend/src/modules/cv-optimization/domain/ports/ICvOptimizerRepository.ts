export interface StoredOptimization {
  id: string;
  createdAt: Date;
  optimizedCvText: string;
}

export interface ICvOptimizerRepository {
  save(optimizedCvText: string): Promise<StoredOptimization>;
  findById(id: string): Promise<StoredOptimization | null>;
}
