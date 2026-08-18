import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resend } from 'resend';

export type SendEmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;

  replyTo?: string;

  attachments?: SendEmailAttachment[];

  idempotencyKey?: string;
};

@Injectable()
export class EmailService {
  async send(input: SendEmailInput) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Transactional email is not configured: RESEND_API_KEY is missing',
      );
    }

    if (!from) {
      throw new ServiceUnavailableException(
        'Transactional email is not configured: EMAIL_FROM is missing',
      );
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send(
      {
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        })),
      },
      input.idempotencyKey
        ? {
            idempotencyKey: input.idempotencyKey,
          }
        : undefined,
    );

    if (error) {
      console.error('Resend email delivery failed', {
        name: error.name,
        message: error.message,
      });

      throw new InternalServerErrorException(
        `Email provider rejected the message: ${error.message}`,
      );
    }

    if (!data?.id) {
      throw new InternalServerErrorException(
        'Email provider did not return a message identifier',
      );
    }

    return {
      id: data.id,
    };
  }
}
