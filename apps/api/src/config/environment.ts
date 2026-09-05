import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    PORT: z.coerce.number().int().positive().default(4000),

    WEB_URL: z.string().url().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(1),

    S3_ENDPOINT: z.string().url().optional(),

    S3_REGION: z.string().min(1).default('auto'),

    S3_BUCKET: z.string().min(1).optional(),

    S3_ACCESS_KEY_ID: z.string().min(1).optional(),

    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),

    CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),

    CLERK_SECRET_KEY: z.string().startsWith('sk_'),

    RESEND_API_KEY: z
      .string()
      .startsWith('re_', {
        message: 'RESEND_API_KEY must start with re_',
      })
      .min(4),

    EMAIL_FROM: z.string().min(1),

    STRIPE_SECRET_KEY: z.string().startsWith('sk_', {
      message: 'STRIPE_SECRET_KEY must start with sk_',
    }),

    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', {
      message: 'STRIPE_WEBHOOK_SECRET must start with whsec_',
    }),

    STRIPE_BILLING_WEBHOOK_SECRET: z
      .string()
      .startsWith('whsec_', {
        message: 'STRIPE_BILLING_WEBHOOK_SECRET must start with whsec_',
      })
      .optional(),

    STRIPE_BILLING_STARTER_MONTHLY_PRICE_ID: z
      .string()
      .startsWith('price_')
      .optional(),

    STRIPE_BILLING_STARTER_ANNUAL_PRICE_ID: z
      .string()
      .startsWith('price_')
      .optional(),

    STRIPE_BILLING_PRO_MONTHLY_PRICE_ID: z
      .string()
      .startsWith('price_')
      .optional(),

    STRIPE_BILLING_PRO_ANNUAL_PRICE_ID: z
      .string()
      .startsWith('price_')
      .optional(),

    STRIPE_BILLING_BUSINESS_MONTHLY_PRICE_ID: z
      .string()
      .startsWith('price_')
      .optional(),

    STRIPE_BILLING_BUSINESS_ANNUAL_PRICE_ID: z
      .string()
      .startsWith('price_')
      .optional(),

    OPENAI_API_KEY: z
      .string()
      .startsWith('sk-', {
        message: 'OPENAI_API_KEY must start with sk-',
      })
      .optional(),

    OPENAI_MODEL: z.string().min(1).default('gpt-5.6'),
  })
  .superRefine((configuration, context) => {
    const storageValues = [
      configuration.S3_ENDPOINT,
      configuration.S3_BUCKET,
      configuration.S3_ACCESS_KEY_ID,
      configuration.S3_SECRET_ACCESS_KEY,
    ];

    const configuredStorageValues = storageValues.filter(
      (value) => value !== undefined,
    ).length;

    if (
      configuredStorageValues > 0 &&
      configuredStorageValues < storageValues.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['S3_ENDPOINT'],
        message:
          'Object storage must configure S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY together',
      });
    }

    if (configuration.NODE_ENV !== 'production') {
      return;
    }

    const productionBillingVariables = [
      {
        key: 'STRIPE_BILLING_WEBHOOK_SECRET',
        value: configuration.STRIPE_BILLING_WEBHOOK_SECRET,
      },
      {
        key: 'STRIPE_BILLING_STARTER_MONTHLY_PRICE_ID',
        value: configuration.STRIPE_BILLING_STARTER_MONTHLY_PRICE_ID,
      },
      {
        key: 'STRIPE_BILLING_STARTER_ANNUAL_PRICE_ID',
        value: configuration.STRIPE_BILLING_STARTER_ANNUAL_PRICE_ID,
      },
      {
        key: 'STRIPE_BILLING_PRO_MONTHLY_PRICE_ID',
        value: configuration.STRIPE_BILLING_PRO_MONTHLY_PRICE_ID,
      },
      {
        key: 'STRIPE_BILLING_PRO_ANNUAL_PRICE_ID',
        value: configuration.STRIPE_BILLING_PRO_ANNUAL_PRICE_ID,
      },
      {
        key: 'STRIPE_BILLING_BUSINESS_MONTHLY_PRICE_ID',
        value: configuration.STRIPE_BILLING_BUSINESS_MONTHLY_PRICE_ID,
      },
      {
        key: 'STRIPE_BILLING_BUSINESS_ANNUAL_PRICE_ID',
        value: configuration.STRIPE_BILLING_BUSINESS_ANNUAL_PRICE_ID,
      },
    ] as const;

    for (const variable of productionBillingVariables) {
      if (variable.value) {
        continue;
      }

      context.addIssue({
        code: 'custom',
        path: [variable.key],
        message: `${variable.key} is required in production`,
      });
    }
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
