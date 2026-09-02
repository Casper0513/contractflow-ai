import { BillingPlan } from '@contractflow/db';
import { IsEnum } from 'class-validator';

export class CreateBillingCheckoutDto {
  @IsEnum(BillingPlan)
  plan!: BillingPlan;
}
