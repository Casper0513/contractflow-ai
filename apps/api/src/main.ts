import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { requestObservabilityMiddleware } from './common/observability/request-observability.middleware';
import type { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const config = app.get<ConfigService<Environment, true>>(ConfigService);

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
