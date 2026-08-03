import { NextFunction, Request, Response } from 'express';
import { OptimizeCvUseCase } from '../../application/use-cases/OptimizeCvUseCase';
import { OptimizeCvInputSchema } from '../../application/dto/OptimizeCvInput';

export class OptimizeCvController {
  constructor(private readonly useCase: OptimizeCvUseCase) {}

  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = OptimizeCvInputSchema.parse(req.body);
      const stored = await this.useCase.execute(input);

      res.status(200).json({
        id: stored.id,
        createdAt: stored.createdAt.toISOString(),
        optimizedCvText: stored.optimizedCvText,
      });
    } catch (error) {
      next(error);
    }
  };
}
