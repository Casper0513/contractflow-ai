import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendInvoiceFollowUpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;
}
