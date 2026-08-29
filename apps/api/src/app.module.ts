import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { ActivityModule } from './activity/activity.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { ChecklistTemplatesModule } from './checklist-templates/checklist-templates.module';
import { validateEnvironment } from './config/environment';
import { CrewModule } from './crew/crew.module';
import { CustomerCommunicationsModule } from './customer-communications/customer-communications.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmailModule } from './email/email.module';
import { EstimateRemindersModule } from './estimate-reminders/estimate-reminders.module';
import { EstimatesModule } from './estimates/estimates.module';
import { HealthModule } from './health/health.module';
import { InvoiceRemindersModule } from './invoice-reminders/invoice-reminders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { JobChecklistsModule } from './job-checklists/job-checklists.module';
import { JobContactsModule } from './job-contacts/job-contacts.module';
import { JobCostsModule } from './job-costs/job-costs.module';
import { JobDocumentsModule } from './job-documents/job-documents.module';
import { JobMaterialsModule } from './job-materials/job-materials.module';
import { JobNotesModule } from './job-notes/job-notes.module';
import { JobPhotosModule } from './job-photos/job-photos.module';
import { JobSchedulesModule } from './job-schedules/job-schedules.module';
import { JobTasksModule } from './job-tasks/job-tasks.module';
import { JobTimeEntriesModule } from './job-time-entries/job-time-entries.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PaymentsModule } from './payments/payments.module';
import { PublicEstimatesModule } from './public-estimates/public-estimates.module';
import { PublicInvoicesModule } from './public-invoices/public-invoices.module';
import { CustomerInternalNotesModule } from './customer-internal-notes/customer-internal-notes.module';
import { TeamMembersModule } from './team-members/team-members.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),

    ScheduleModule.forRoot(),

    ActivityModule,
    AiModule,
    CustomerCommunicationsModule,

    DashboardModule,
    HealthModule,
    AuthModule,

    EstimatesModule,
    EstimateRemindersModule,
    PublicEstimatesModule,

    CrewModule,
    JobMaterialsModule,
    JobTimeEntriesModule,
    JobsModule,
    JobSchedulesModule,
    JobTasksModule,
    JobPhotosModule,
    JobCostsModule,
    JobDocumentsModule,
    JobNotesModule,
    JobContactsModule,
    JobChecklistsModule,
    ChecklistTemplatesModule,

    InvoicesModule,
    InvoiceRemindersModule,
    PaymentsModule,
    PublicInvoicesModule,

    OrganizationsModule,
    CustomersModule,
    CustomerInternalNotesModule,
    TeamMembersModule,
    EmailModule,
    NotificationsModule,
  ],
})
export class AppModule {}
