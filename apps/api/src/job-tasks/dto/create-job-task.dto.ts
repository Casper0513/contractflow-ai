import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { JobTaskPriority, JobTaskStatus } from '@contractflow/db';

export class CreateJobTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(JobTaskStatus)
  status?: JobTaskStatus;

  @IsOptional()
  @IsEnum(JobTaskPriority)
  priority?: JobTaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
