-- Persist Stripe's explicit scheduled subscription cancellation timestamp.
ALTER TABLE "BillingSubscription"
ADD COLUMN "cancelAt" TIMESTAMP(3);
