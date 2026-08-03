import { Router } from 'express';
import { OptimizeCvController } from './OptimizeCvController';
import { GenerateGreetingController } from './GenerateGreetingController';

export function createCvOptimizationRouter(
  optimizeCvController: OptimizeCvController,
  generateGreetingController: GenerateGreetingController,
): Router {
  const router = Router();

  router.post('/optimize', optimizeCvController.handle);
  router.post('/generate-greeting', generateGreetingController.handle);

  return router;
}
