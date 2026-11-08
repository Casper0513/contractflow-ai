import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  const productionEnvironment = {
    NODE_ENV: 'production',

    DATABASE_URL: 'postgresql://user:password@localhost:5432/contractflow',

    SENTRY_DSN: 'https://examplePublicKey@example.com/1',

    CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    CLERK_SECRET_KEY: 'sk_test_example',
    CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_clerk_example',

    RESEND_API_KEY: 're_example',
    EMAIL_FROM: 'ContractFlow <notifications@example.com>',

    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_payment_example',
    STRIPE_BILLING_WEBHOOK_SECRET: 'whsec_billing_example',

    STRIPE_BILLING_STARTER_MONTHLY_PRICE_ID: 'price_starter_monthly',
    STRIPE_BILLING_STARTER_ANNUAL_PRICE_ID: 'price_starter_annual',
    STRIPE_BILLING_PRO_MONTHLY_PRICE_ID: 'price_pro_monthly',
    STRIPE_BILLING_PRO_ANNUAL_PRICE_ID: 'price_pro_annual',
    STRIPE_BILLING_BUSINESS_MONTHLY_PRICE_ID: 'price_business_monthly',
    STRIPE_BILLING_BUSINESS_ANNUAL_PRICE_ID: 'price_business_annual',
  };

  it('requires ORIGIN_AUTH_SECRET in production', () => {
    expect(() => validateEnvironment(productionEnvironment)).toThrow(
      'Environment validation failed',
    );
  });

  it('accepts production when ORIGIN_AUTH_SECRET is configured', () => {
    expect(
      validateEnvironment({
        ...productionEnvironment,
        ORIGIN_AUTH_SECRET:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      }).ORIGIN_AUTH_SECRET,
    ).toHaveLength(64);
  });
});
