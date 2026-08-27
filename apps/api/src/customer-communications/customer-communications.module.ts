import { Global, Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { CustomerCommunicationsService } from './customer-communications.service';

@Global()
@Module({
  imports: [EmailModule],
  providers: [CustomerCommunicationsService],
  exports: [CustomerCommunicationsService],
})
export class CustomerCommunicationsModule {}
