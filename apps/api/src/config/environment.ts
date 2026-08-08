import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(4000),

  WEB_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().url(),

  CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),

  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  configuration: Record<string, unknown>,
): Environment {
  const result = environmentSchema.safeParse(configuration);

  if (!result.success) {
    console.error(
      'Invalid environment configuration:',
      result.error.flatten().fieldErrors,
    );

    throw new Error('Environment validation failed');
  }

  return result.data;
}
