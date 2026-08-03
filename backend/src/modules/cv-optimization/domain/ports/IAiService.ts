export interface HallucinationValidationResult {
  isValid: boolean;
  issues: string[];
  correctedText: string;
}

export interface IAiService {
  optimize(cvText: string, jobOfferText: string, observaciones?: string): Promise<string>;
  generateGreeting(cvText: string, jobOfferText: string): Promise<string>;
  validateNoHallucinations(
    originalCvText: string,
    optimizedCvText: string,
  ): Promise<HallucinationValidationResult>;
}
