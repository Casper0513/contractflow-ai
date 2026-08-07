import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { OrganizationsModule } from "./organizations/organizations.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    HealthModule,
    AuthModule,
    OrganizationsModule,
  ],
})
export class AppModule {}