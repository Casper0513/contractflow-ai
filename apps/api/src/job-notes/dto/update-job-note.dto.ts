import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateJobNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}
