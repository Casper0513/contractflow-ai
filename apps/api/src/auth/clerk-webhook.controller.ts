import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import type { Environment } from '../config/environment';
import { AuthService } from './auth.service';

@Controller('auth/clerk')
export class ClerkWebhookController {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly authService: AuthService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() request: RawBodyRequest<Request>) {
    if (!request.rawBody) {
      throw new BadRequestException('Clerk webhook raw body is unavailable');
    }

    const signingSecret = this.configService.get(
      'CLERK_WEBHOOK_SIGNING_SECRET',
      {
        infer: true,
      },
    );

    if (!signingSecret) {
      throw new ServiceUnavailableException('Clerk webhook is not configured');
    }

    const url = `${request.protocol || 'http'}://${request.get('host') || 'localhost:4000'}${request.originalUrl}`;

    const headers = new Headers();

    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') {
        headers.set(name, value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(name, item);
        }
      }
    }

    let event;

    try {
      event = await verifyWebhook(
        new Request(url, {
          method: 'POST',
          headers,
          body: new Uint8Array(request.rawBody),
        }),
        {
          signingSecret,
        },
      );
    } catch {
      throw new BadRequestException('Invalid Clerk webhook signature');
    }

    if (event.type === 'user.deleted') {
      if (!event.data.id) {
        throw new BadRequestException(
          'Clerk deleted-user webhook is missing a user ID',
        );
      }

      await this.authService.handleClerkUserDeleted(event.data.id);
    }

    return {
      received: true,
    };
  }
}
