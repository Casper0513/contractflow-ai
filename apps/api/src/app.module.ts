import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

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
import { InvoiceRemindersModule } from './invoice-reminders/invoice-reminders.module';
import { PublicEstimatesModule } from './public-estimates/public-estimates.module';
import { EstimateRemindersModule } from './estimate-reminders/estimate-reminders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JobCostsModule } from './job-costs/job-costs.module';
import { JobMaterialsModule } from './job-materials/job-materials.module';
import { CrewModule } from './crew/crew.module';
import { JobTimeEntriesModule } from './job-time-entries/job-time-entries.module';
import { JobPhotosModule } from './job-photos/job-photos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),

    ScheduleModule.forRoot(),

    ActivityModule,
    DashboardModule,
    HealthModule,
    AuthModule,
    EstimatesModule,
    CrewModule,
    JobMaterialsModule,
    JobTimeEntriesModule,
    JobsModule,
    JobSchedulesModule,
    JobTasksModule,
    JobPhotosModule,
    JobCostsModule,
    InvoicesModule,
    InvoiceRemindersModule,
    PublicEstimatesModule,
    EstimateRemindersModule,
    PaymentsModule,
    PublicInvoicesModule,
    OrganizationsModule,
    CustomersModule,
    EmailModule,
  ],
})
export class AppModule {}
