import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
  AI_PROVIDER_API_KEY: z.string().min(1, 'AI_PROVIDER_API_KEY es requerido.'),
  AI_PROVIDER_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_PROVIDER_MODEL: z.string().default('gpt-4o-mini'),
});

export const env = EnvSchema.parse(process.env);
