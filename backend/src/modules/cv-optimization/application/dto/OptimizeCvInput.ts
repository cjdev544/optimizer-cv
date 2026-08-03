import { z } from 'zod';
import { CvJobOfferInputSchema } from './CvJobOfferInput';

export const OptimizeCvInputSchema = CvJobOfferInputSchema.extend({
  observaciones: z.string().optional(),
});

export type OptimizeCvInput = z.infer<typeof OptimizeCvInputSchema>;
