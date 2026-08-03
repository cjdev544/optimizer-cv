import { Cv } from '../../domain/entities/Cv';
import { JobOffer } from '../../domain/entities/JobOffer';
import { IAiService } from '../../domain/ports/IAiService';
import { IPiiMaskingService } from '../../domain/ports/IPiiMaskingService';
import { CvJobOfferInput } from '../dto/CvJobOfferInput';

export class GenerateGreetingUseCase {
  constructor(
    private readonly aiService: IAiService,
    private readonly piiMaskingService: IPiiMaskingService,
  ) {}

  async execute(input: CvJobOfferInput): Promise<string> {
    const cv = Cv.create(input.cvText);
    const jobOffer = JobOffer.create(input.jobOfferText);

    const { maskedText, mapping } = this.piiMaskingService.mask(cv.getText());
    const maskedGreeting = await this.aiService.generateGreeting(maskedText, jobOffer.getDescription());

    return this.piiMaskingService.unmask(maskedGreeting, mapping);
  }
}
