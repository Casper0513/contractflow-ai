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
    OrganizationsModule,
    CustomersModule,
  ],
})
export class AppModule {}
