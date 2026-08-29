import { IsString, MaxLength, MinLength } from 'class-validator';

export class AskAiDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
