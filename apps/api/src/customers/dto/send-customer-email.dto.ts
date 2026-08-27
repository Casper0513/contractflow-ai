import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendCustomerEmailDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  message!: string;
}
