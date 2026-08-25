import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateJobChecklistDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
