import { Cv } from '../../domain/entities/Cv';
import { JobOffer } from '../../domain/entities/JobOffer';
import { IAiService } from '../../domain/ports/IAiService';
import { ICvOptimizerRepository, StoredOptimization } from '../../domain/ports/ICvOptimizerRepository';
import { IPiiMaskingService } from '../../domain/ports/IPiiMaskingService';
import { OptimizeCvInput } from '../dto/OptimizeCvInput';

export class OptimizeCvUseCase {
  constructor(
    private readonly aiService: IAiService,
    private readonly repository: ICvOptimizerRepository,
    private readonly piiMaskingService: IPiiMaskingService,
  ) {}

  async execute(input: OptimizeCvInput): Promise<StoredOptimization> {
    const cv = Cv.create(input.cvText);
    const jobOffer = JobOffer.create(input.jobOfferText);

    const { maskedText, mapping } = this.piiMaskingService.mask(cv.getText());
    const maskedResult = await this.aiService.optimize(
      maskedText,
      jobOffer.getDescription(),
      input.observaciones,
    );

    const validation = await this.aiService.validateNoHallucinations(maskedText, maskedResult);
    if (!validation.isValid) {
      console.warn('[OptimizeCvUseCase] Validación de alucinaciones corrigió el resultado:', validation.issues);
    }

    const optimizedCvText = this.piiMaskingService.unmask(validation.correctedText, mapping);

    return this.repository.save(optimizedCvText);
  }
}
