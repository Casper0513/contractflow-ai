import { Controller, Get } from '@nestjs/common';
import { db } from '@contractflow/db-prisma8';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const plan = db.raw.sql`
        SELECT 1 AS ok
      `
      .returnsRow({
        ok: 'pg/int4@1',
      })
      .build();

    await db.transaction(async (tx) => {
      for await (const row of tx.query(plan)) {
        if (row.ok !== 1) {
          throw new Error(
            'Database health check returned an unexpected result',
          );
        }

        return;
      }

      throw new Error('Database health check returned no rows');
    });

    return {
      status: 'ok',
      service: 'contractflow-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
