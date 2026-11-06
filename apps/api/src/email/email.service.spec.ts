import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

const mockResendSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend,
    },
  })),
}));

import { EmailService } from './email.service';

describe('EmailService', () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.RESEND_API_KEY = 're_test_contractflow';
    process.env.EMAIL_FROM = 'ContractFlow <notifications@contractflowops.com>';
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }

    if (originalEmailFrom === undefined) {
      delete process.env.EMAIL_FROM;
    } else {
      process.env.EMAIL_FROM = originalEmailFrom;
    }
  });

  it('fails closed when the Resend API key is unavailable', async () => {
    delete process.env.RESEND_API_KEY;

    const service = new EmailService();

    await expect(
      service.send({
        to: 'customer@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('sanitizes provider errors when Resend delivery fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockResendSend.mockResolvedValue({
      data: null,
      error: {
        name: 'validation_error',
        message:
          'Sensitive provider detail for customer@example.com and request req_123',
      },
    });

    const service = new EmailService();

    try {
      await expect(
        service.send({
          to: 'customer@example.com',
          subject: 'Sensitive customer subject',
          html: '<p>Sensitive body</p>',
          text: 'Sensitive body',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(consoleError).toHaveBeenCalledWith('Resend email delivery failed');

      const logged = consoleError.mock.calls.flat().join(' ');

      expect(logged).not.toContain('validation_error');
      expect(logged).not.toContain('Sensitive provider detail');
      expect(logged).not.toContain('customer@example.com');
      expect(logged).not.toContain('req_123');
      expect(logged).not.toContain('Sensitive customer subject');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('returns the provider message identifier after successful delivery', async () => {
    mockResendSend.mockResolvedValue({
      data: {
        id: 'email_123',
      },
      error: null,
    });

    const service = new EmailService();

    await expect(
      service.send({
        to: 'customer@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      }),
    ).resolves.toEqual({
      id: 'email_123',
    });
  });
});
