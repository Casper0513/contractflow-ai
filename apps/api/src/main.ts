import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { AppModule } from './app.module';
import type { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const webUrl = config.get('WEB_URL', { infer: true });

  app.setGlobalPrefix('api');

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

  await app.listen(port, '0.0.0.0');

  console.warn(`ContractFlow API running at http://localhost:${port}/api`);
}

void bootstrap();
