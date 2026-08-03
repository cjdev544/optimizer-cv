import { env } from '../../../../config/env';
import { OptimizeCvUseCase } from '../../application/use-cases/OptimizeCvUseCase';
import { GenerateGreetingUseCase } from '../../application/use-cases/GenerateGreetingUseCase';
import { OpenAiService } from '../ai/OpenAiService';
import { RegexPiiMaskingService } from '../privacy/RegexPiiMaskingService';
import { InMemoryCvOptimizerRepository } from '../persistence/InMemoryCvOptimizerRepository';
import { OptimizeCvController } from '../http/OptimizeCvController';
import { GenerateGreetingController } from '../http/GenerateGreetingController';
import { createCvOptimizationRouter } from '../http/cv-optimization.routes';

const aiService = new OpenAiService({
  apiKey: env.AI_PROVIDER_API_KEY,
  baseUrl: env.AI_PROVIDER_BASE_URL,
  model: env.AI_PROVIDER_MODEL,
});

const repository = new InMemoryCvOptimizerRepository();
const piiMaskingService = new RegexPiiMaskingService();

const optimizeCvUseCase = new OptimizeCvUseCase(aiService, repository, piiMaskingService);
const generateGreetingUseCase = new GenerateGreetingUseCase(aiService, piiMaskingService);

const optimizeCvController = new OptimizeCvController(optimizeCvUseCase);
const generateGreetingController = new GenerateGreetingController(generateGreetingUseCase);

export const cvOptimizationRouter = createCvOptimizationRouter(
  optimizeCvController,
  generateGreetingController,
);
