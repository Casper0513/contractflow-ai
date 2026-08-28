import { JobScheduleType } from '@contractflow/db';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateDispatchSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  defaultStartHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  defaultStartMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(1440)
  defaultDurationMinutes?: number;

  @IsOptional()
  @IsEnum(JobScheduleType)
  defaultScheduleType?: JobScheduleType;
}
