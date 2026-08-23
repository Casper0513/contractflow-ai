import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateJobDocumentUploadDto {
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
}
