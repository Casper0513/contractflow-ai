import { IsString } from 'class-validator';

export class ApplyChecklistTemplateDto {
  @IsString()
  templateId!: string;
}
