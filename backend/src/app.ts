import cors from 'cors';
import express, { Express } from 'express';
import { env } from './config/env';
import { errorHandler } from './shared/http/errorHandler';
import { cvOptimizationRouter } from './modules/cv-optimization/infrastructure/di/container';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.ALLOWED_ORIGIN }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/cv-optimization', cvOptimizationRouter);

  app.use(errorHandler);

  return app;
}
