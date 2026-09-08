import { SetMetadata } from '@nestjs/common';

import { BillingEntitlement } from './billing-entitlement.policy';

export const BILLING_ENTITLEMENT_KEY = 'billing-entitlement';

export const RequiresBillingEntitlement = (entitlement: BillingEntitlement) =>
  SetMetadata(BILLING_ENTITLEMENT_KEY, entitlement);
