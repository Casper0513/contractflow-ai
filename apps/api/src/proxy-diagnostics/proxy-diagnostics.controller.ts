import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Environment } from '../config/environment';

/*
 * TEMPORARY: one-off diagnostic for verifying Railway proxy behavior on
 * api.contractflowops.com. Remove this controller, its module, its spec, and
 * the ProxyDiagnosticsModule import in AppModule once the test is done.
 *
 * Returns ONLY: req.ip, req.ips, x-real-ip, x-forwarded-for, and the socket
 * remote address. It never reads cookies, authorization, the body, or any
 * other header. Responds 404 outside NODE_ENV=production.
 */
@Controller('_diagnostics/proxy')
export class ProxyDiagnosticsController {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  @Get()
  inspect(@Req() req: Request) {
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      throw new NotFoundException();
    }

    return {
      reqIp: req.ip ?? null,
      reqIps: req.ips,
      xRealIp: req.headers['x-real-ip'] ?? null,
      xForwardedFor: req.headers['x-forwarded-for'] ?? null,
      socketRemoteAddress: req.socket.remoteAddress ?? null,
    };
  }
}
