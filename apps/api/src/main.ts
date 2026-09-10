import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/observability/api-exception.filter';
import { requestObservabilityMiddleware } from './common/observability/request-observability.middleware';
import type { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  const sentryDsn = config.get('SENTRY_DSN', {
    infer: true,
  });

  const nodeEnvironment = config.get('NODE_ENV', {
    infer: true,
  });

  /*
   * ContractFlow currently uses Sentry for explicit exception delivery only.
   *
   * Automatic integrations are disabled here so the SDK does not
   * independently collect request headers, cookies, bodies, query strings,
   * tracing data, or duplicate exceptions already owned by
   * ApiExceptionFilter.
   */
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: nodeEnvironment,
      sendDefaultPii: false,
      defaultIntegrations: false,
      tracesSampleRate: 0,
    });
  }

  const port = config.get('PORT', {
    infer: true,
  });

  const webUrl = config.get('WEB_URL', {
    infer: true,
  });

  app.setGlobalPrefix('api');

  app.use(requestObservabilityMiddleware);

  app.use(helmet());

  app.enableCors({
    origin: webUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const { httpAdapter } = app.get(HttpAdapterHost);

  app.useGlobalFilters(new ApiExceptionFilter(httpAdapter));

  /*
   * Allow Nest providers to participate in clean shutdown when
   * Railway sends SIGTERM during deploys or service restarts.
   */
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');

  logger.log(`ContractFlow API listening on 0.0.0.0:${port}/api`);
}

void bootstrap();
