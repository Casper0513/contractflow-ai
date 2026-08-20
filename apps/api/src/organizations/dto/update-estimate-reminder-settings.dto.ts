import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateEstimateReminderSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  firstFollowUpEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  firstFollowUpDays?: number;

  @IsOptional()
  @IsBoolean()
  secondFollowUpEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  secondFollowUpDays?: number;
}
