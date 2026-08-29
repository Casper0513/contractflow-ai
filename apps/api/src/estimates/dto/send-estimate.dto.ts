import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendEstimateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message?: string;
}
