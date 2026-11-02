import { Module } from '@nestjs/common';

import { ProxyDiagnosticsController } from './proxy-diagnostics.controller';

// TEMPORARY: see ProxyDiagnosticsController. Remove after the diagnostic test.
@Module({
  controllers: [ProxyDiagnosticsController],
})
export class ProxyDiagnosticsModule {}
