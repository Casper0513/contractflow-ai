import { PartialType } from '@nestjs/mapped-types';

import { CreateCustomerInternalNoteDto } from './create-customer-internal-note.dto';

export class UpdateCustomerInternalNoteDto extends PartialType(
  CreateCustomerInternalNoteDto,
) {}
