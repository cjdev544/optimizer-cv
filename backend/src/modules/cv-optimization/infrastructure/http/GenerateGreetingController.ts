import { NextFunction, Request, Response } from 'express';
import { GenerateGreetingUseCase } from '../../application/use-cases/GenerateGreetingUseCase';
import { CvJobOfferInputSchema } from '../../application/dto/CvJobOfferInput';

export class GenerateGreetingController {
  constructor(private readonly useCase: GenerateGreetingUseCase) {}

  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = CvJobOfferInputSchema.parse(req.body);
      const greeting = await this.useCase.execute(input);

      res.status(200).json({ greeting });
    } catch (error) {
      next(error);
    }
  };
}
