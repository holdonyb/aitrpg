import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import { InviteCodesService } from '../invite-codes/invite-codes.service';
import { isPrimaryStoreUnavailable } from '../store/fallback';
import { MemoryStoreService } from '../store/memory-store.service';
import { MailerService, VerificationDeliveryError } from './mailer.service';

@Injectable()
export class AuthService {
  private readonly sendCodeCooldownMs = 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly memoryStore: MemoryStoreService,
    private readonly mailerService: MailerService,
    private readonly inviteCodesService: InviteCodesService,
  ) {}

  async issueCode(email: string, inviteCode?: string) {
    const { inviteCodeId } = await this.inviteCodesService.prepareForEmailCode(
      email,
      inviteCode,
    );

    await this.enforceCodeCooldown(email);

    const code = `${randomInt(100000, 999999)}`;
    await this.withFallback(
      async () => {
        await this.prisma.emailCodeChallenge.deleteMany({
          where: { email },
        });

        await this.prisma.emailCodeChallenge.create({
          data: {
            email,
            code,
            inviteCodeId,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      },
      () => {
        this.memoryStore.saveCode(email, code, inviteCodeId);
      },
    );

    let delivery;
    try {
      delivery = await this.mailerService.sendVerificationCode(email, code);
    } catch (error) {
      if (error instanceof VerificationDeliveryError) {
        throw new ServiceUnavailableException({
          message: error.message,
          code: error.code,
        });
      }

      throw error;
    }

    return {
      ok: true,
      debugCode: delivery.debugCode,
    };
  }

  private async enforceCodeCooldown(email: string) {
    const retryAfterSeconds = await this.withFallback(
      async () => {
        const latestChallenge = await this.prisma.emailCodeChallenge.findFirst({
          where: { email },
          orderBy: { createdAt: 'desc' },
        });

        return this.getRetryAfterSeconds(latestChallenge?.createdAt);
      },
      () => {
        const latestRecord = this.memoryStore.getCodeRecord(email);
        return this.getRetryAfterSeconds(
          latestRecord ? new Date(latestRecord.issuedAt) : undefined,
        );
      },
    );

    if (retryAfterSeconds > 0) {
      throw new HttpException(
        {
          message: 'Verification code recently sent',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getRetryAfterSeconds(issuedAt?: Date) {
    if (!issuedAt) {
      return 0;
    }

    const elapsed = Date.now() - issuedAt.getTime();
    if (elapsed >= this.sendCodeCooldownMs) {
      return 0;
    }

    return Math.ceil((this.sendCodeCooldownMs - elapsed) / 1000);
  }

  async verifyCode(email: string, code: string) {
    const localRecord = this.memoryStore.getCodeRecord(email);
    if (this.memoryStore.verifyCode(email, code)) {
      const existingUser = this.memoryStore.findUserByEmail(email);
      if (!existingUser) {
        await this.inviteCodesService.consumeInviteForNewUser(
          localRecord?.inviteCodeId,
        );
      }
      const user = this.memoryStore.findOrCreateUser(email);
      const secret =
        this.configService.get<string>('JWT_SECRET') || 'aitrpg-dev-secret';
      const token = jwt.sign({ sub: user.id, email: user.email }, secret, {
        expiresIn: '7d',
      });

      return {
        token,
        user,
      };
    }

    const user = await this.withFallback(
      async () => {
        const challenge = await this.prisma.emailCodeChallenge.findFirst({
          where: { email },
          orderBy: { createdAt: 'desc' },
        });

        if (
          !challenge ||
          challenge.code !== code ||
          challenge.expiresAt.getTime() < Date.now()
        ) {
          throw new UnauthorizedException('Invalid verification code');
        }

        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });

        if (!existingUser) {
          await this.inviteCodesService.consumeInviteForNewUser(
            challenge.inviteCodeId ?? undefined,
          );
        }

        await this.prisma.emailCodeChallenge.deleteMany({
          where: { email },
        });

        return (
          existingUser ??
          (await this.prisma.user.create({
            data: {
              email,
              displayName: email.split('@')[0] ?? email,
            },
          }))
        );
      },
      async () => {
        const record = this.memoryStore.getCodeRecord(email);
        if (!this.memoryStore.verifyCode(email, code)) {
          throw new UnauthorizedException('Invalid verification code');
        }

        const existingUser = this.memoryStore.findUserByEmail(email);
        if (!existingUser) {
          await this.inviteCodesService.consumeInviteForNewUser(
            record?.inviteCodeId,
          );
        }

        return this.memoryStore.findOrCreateUser(email);
      },
    );

    const secret =
      this.configService.get<string>('JWT_SECRET') || 'aitrpg-dev-secret';
    const token = jwt.sign({ sub: user.id, email: user.email }, secret, {
      expiresIn: '7d',
    });

    return {
      token,
      user,
    };
  }

  async authenticateHeader(header?: string) {
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);
    const secret =
      this.configService.get<string>('JWT_SECRET') || 'aitrpg-dev-secret';
    const payload = jwt.verify(token, secret) as { sub: string };
    const cachedUser = this.memoryStore.getUser(payload.sub);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.withFallback(
      () =>
        this.prisma.user.findUnique({
          where: { id: payload.sub },
        }),
      () => this.memoryStore.getUser(payload.sub),
    );

    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    return user;
  }

  private async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => T | Promise<T>,
  ) {
    if (this.configService.get<string>('DATA_STORE_MODE') === 'file') {
      return fallback();
    }

    try {
      return await Promise.race([
        primary(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Primary store timeout')), 1500);
        }),
      ]);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof HttpException
      ) {
        throw error;
      }

      if (isPrimaryStoreUnavailable(error)) {
        return fallback();
      }

      throw error;
    }
  }
}
