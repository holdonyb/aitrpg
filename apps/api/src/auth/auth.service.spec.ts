import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { MemoryStoreService } from '../store/memory-store.service';
import { AuthService } from './auth.service';
import { MailerService, VerificationDeliveryError } from './mailer.service';

describe('AuthService', () => {
  function createService(mailerService: Partial<MailerService>) {
    const configService = {
      get(key: string) {
        if (key === 'DATA_STORE_MODE') {
          return 'file';
        }

        if (key === 'JWT_SECRET') {
          return 'test-secret';
        }

        return undefined;
      },
    } as ConfigService;

    return new AuthService(
      configService,
      {} as PrismaService,
      new MemoryStoreService(configService),
      mailerService as MailerService,
    );
  }

  it('maps verification delivery errors to 503 responses', async () => {
    const service = createService({
      sendVerificationCode: jest
        .fn()
        .mockRejectedValue(
          new VerificationDeliveryError(
            'Resend sandbox only allows delivery to the owner email until a domain is verified.',
            'resend_sandbox_restricted',
          ),
        ),
    });

    await expect(service.issueCode('dm@example.com')).rejects.toMatchObject({
      response: {
        code: 'resend_sandbox_restricted',
      },
    } satisfies Partial<ServiceUnavailableException>);
  });
});
