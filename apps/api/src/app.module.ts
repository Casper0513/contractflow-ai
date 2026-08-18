import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CustomersModule } from './customers/customers.module';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ActivityModule } from './activity/activity.module';
import { JobsModule } from './jobs/jobs.module';
import { JobTasksModule } from './job-tasks/job-tasks.module';
import { JobSchedulesModule } from './job-schedules/job-schedules.module';
import { EstimatesModule } from './estimates/estimates.module';
import { InvoicesModule } from './invoices/invoices.module';
import { EmailModule } from './email/email.module';
import { PublicInvoicesModule } from './public-invoices/public-invoices.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ActivityModule,
    HealthModule,
    AuthModule,
    JobTasksModule,
    JobsModule,
    JobSchedulesModule,
    EstimatesModule,
    InvoicesModule,
    PaymentsModule,
    PublicInvoicesModule,
    OrganizationsModule,
    CustomersModule,
    EmailModule,
  ],
})
export class AppModule {}
