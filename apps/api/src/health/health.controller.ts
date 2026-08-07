import { Controller, Get } from "@nestjs/common";
import { prisma } from "@contractflow/db";

@Controller("health")
export class HealthController {
  @Get()
  async check() {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      service: "contractflow-api",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  }
}