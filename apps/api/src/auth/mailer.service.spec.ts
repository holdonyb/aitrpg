import { ConfigService } from '@nestjs/config';

import { MailerService } from './mailer.service';

describe('MailerService', () => {
  it('returns the debug code when delivery mode is debug', async () => {
    const configService = {
      get(key: string) {
        if (key === 'EMAIL_DELIVERY_MODE') {
          return 'debug';
        }
        return undefined;
      },
    } as ConfigService;

    const service = new MailerService(configService);

    await expect(
      service.sendVerificationCode('dm@example.com', '123456'),
    ).resolves.toEqual({
      delivered: false,
      debugCode: '123456',
    });
  });

  it('prefers resend mode when a resend key is present', async () => {
    const configService = {
      get(key: string) {
        if (key === 'RESEND_API_KEY') {
          return 're_test';
        }

        if (key === 'EMAIL_FROM') {
          return 'AITRPG <onboarding@resend.dev>';
        }

        return undefined;
      },
    } as ConfigService;

    const service = new MailerService(configService);
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'email_123' } });

    Object.assign(service as object, {
      resend: {
        emails: {
          send: mockSend,
        },
      },
    });

    await expect(
      service.sendVerificationCode('dm@example.com', '654321'),
    ).resolves.toEqual({
      delivered: true,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['dm@example.com'],
        subject: 'AITRPG 登录验证码',
      }),
    );
  });
});
