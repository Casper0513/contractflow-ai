import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Environment } from '../config/environment';
import { ProxyDiagnosticsController } from './proxy-diagnostics.controller';

// TEMPORARY: removed together with the controller after the diagnostic test.
function build(nodeEnv: string) {
  const config = {
    get: () => nodeEnv,
  } as unknown as ConfigService<Environment, true>;

  return new ProxyDiagnosticsController(config);
}

const request = {
  ip: '10.0.0.2',
  ips: ['203.0.113.9', '10.0.0.2'],
  headers: {
    'x-real-ip': '203.0.113.9',
    'x-forwarded-for': '1.2.3.4, 203.0.113.9',
    authorization: 'Bearer secret',
    cookie: 'session=secret',
  },
  socket: { remoteAddress: '100.64.0.1' },
  body: { secret: 'value' },
} as unknown as Request;

describe('ProxyDiagnosticsController (TEMPORARY)', () => {
  it('returns only the five proxy fields in production', () => {
    expect(build('production').inspect(request)).toEqual({
      reqIp: '10.0.0.2',
      reqIps: ['203.0.113.9', '10.0.0.2'],
      xRealIp: '203.0.113.9',
      xForwardedFor: '1.2.3.4, 203.0.113.9',
      socketRemoteAddress: '100.64.0.1',
    });
  });

  it.each(['development', 'test'])('responds 404 when NODE_ENV=%s', (env) => {
    expect(() => build(env).inspect(request)).toThrow(NotFoundException);
  });
});
