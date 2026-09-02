import { BillingInterval, BillingPlan } from '@contractflow/db';
import { IsEnum } from 'class-validator';

export class CreateBillingCheckoutDto {
  @IsEnum(BillingPlan)
  plan!: BillingPlan;

  @IsEnum(BillingInterval)
  interval!: BillingInterval;
}
