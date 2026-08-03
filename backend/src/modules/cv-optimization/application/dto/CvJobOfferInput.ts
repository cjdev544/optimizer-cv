import { z } from 'zod';

export const CvJobOfferInputSchema = z.object({
  cvText: z.string().min(50, 'El CV debe tener al menos 50 caracteres.'),
  jobOfferText: z.string().min(30, 'La oferta de empleo debe tener al menos 30 caracteres.'),
});

export type CvJobOfferInput = z.infer<typeof CvJobOfferInputSchema>;
