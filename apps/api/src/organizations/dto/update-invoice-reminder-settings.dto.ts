import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateInvoiceReminderSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  beforeDueEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  beforeDueDays?: number;

  @IsOptional()
  @IsBoolean()
  dueTodayEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  firstOverdueEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  firstOverdueDays?: number;

  @IsOptional()
  @IsBoolean()
  secondOverdueEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  secondOverdueDays?: number;
}
