import { JobPhotoCategory } from '@contractflow/db';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateJobPhotoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  storageKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalFileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsOptional()
  @IsEnum(JobPhotoCategory)
  category?: JobPhotoCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsDateString()
  takenAt?: string;
}
