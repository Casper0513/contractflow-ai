import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class ImportInvoiceMaterialsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  materialIds!: string[];
}
