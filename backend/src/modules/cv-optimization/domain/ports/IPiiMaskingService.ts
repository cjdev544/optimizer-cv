export interface PiiMaskingResult {
  maskedText: string;
  mapping: Record<string, string>;
}

export interface IPiiMaskingService {
  mask(text: string): PiiMaskingResult;
  unmask(text: string, mapping: Record<string, string>): string;
}
