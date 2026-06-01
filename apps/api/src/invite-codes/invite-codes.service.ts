import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inviteCodeCreateSchema } from '@aitrpg/shared';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { isPrimaryStoreUnavailable } from '../store/fallback';
import { MemoryStoreService } from '../store/memory-store.service';

type InviteCodeRecord = {
  id: string;
  code: string;
  status: string;
  usageLimit: number;
  usedCount: number;
  expiresAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class InviteCodesService {
  private seedPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly memoryStore: MemoryStoreService,
  ) {}

  async prepareForEmailCode(email: string, inviteCode?: string) {
    await this.ensureSeedInviteCodes();

    const existingUser = await this.withFallback(
      () =>
        this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        }),
      () => Promise.resolve(this.memoryStore.findUserByEmail(email) ?? null),
    );

    if (existingUser) {
      return { inviteCodeId: undefined as string | undefined };
    }

    if (!inviteCode?.trim()) {
      throw new ForbiddenException('Invite code required');
    }

    const record = await this.findInviteCodeByCode(inviteCode.trim());
    this.assertInviteCodeUsable(record);
    return { inviteCodeId: record!.id };
  }

  async consumeInviteForNewUser(inviteCodeId?: string) {
    if (!inviteCodeId) {
      return;
    }

    await this.ensureSeedInviteCodes();

    await this.withFallback(
      async () => {
        const record = await this.prisma.inviteCode.findUnique({
          where: { id: inviteCodeId },
        });
        this.assertInviteCodeUsable(record);

        await this.prisma.inviteCode.update({
          where: { id: inviteCodeId },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });
      },
      async () => {
        const record = this.normalizeInviteCode(
          this.memoryStore.getInviteCodeById(inviteCodeId),
        );
        this.assertInviteCodeUsable(record);
        this.memoryStore.incrementInviteCodeUsage(inviteCodeId);
      },
    );
  }

  async listInviteCodes() {
    await this.ensureSeedInviteCodes();

    return this.withFallback(
      () =>
        this.prisma.inviteCode.findMany({
          orderBy: { createdAt: 'desc' },
        }),
      () =>
        Promise.resolve(
          this.memoryStore
            .listInviteCodes()
            .map((record) => this.normalizeInviteCode(record)!),
        ),
    );
  }

  async createInviteCode(body: unknown) {
    await this.ensureSeedInviteCodes();
    const input = inviteCodeCreateSchema.parse(body);
    const code = input.code?.trim() || this.generateInviteCode();
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;

    return this.withFallback(
      async () =>
        this.prisma.inviteCode.create({
          data: {
            code,
            usageLimit: input.usageLimit,
            expiresAt,
          },
        }),
      async () =>
        this.normalizeInviteCode(
          this.memoryStore.createInviteCode({
            code,
            usageLimit: input.usageLimit,
            expiresAt,
          }),
        )!,
    );
  }

  async disableInviteCode(inviteCodeId: string) {
    await this.ensureSeedInviteCodes();

    return this.withFallback(
      async () => {
        try {
          return await this.prisma.inviteCode.update({
            where: { id: inviteCodeId },
            data: {
              status: 'disabled',
            },
          });
        } catch {
          throw new NotFoundException('Invite code not found');
        }
      },
      async () => {
        const updated = this.memoryStore.disableInviteCode(inviteCodeId);
        if (!updated) {
          throw new NotFoundException('Invite code not found');
        }
        return this.normalizeInviteCode(updated)!;
      },
    );
  }

  private assertInviteCodeUsable(record: InviteCodeRecord | null | undefined) {
    if (!record) {
      throw new ForbiddenException('Invite code invalid');
    }

    if (record.status !== 'active') {
      throw new ForbiddenException('Invite code disabled');
    }

    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('Invite code expired');
    }

    if (record.usedCount >= record.usageLimit) {
      throw new ForbiddenException('Invite code exhausted');
    }
  }

  private async findInviteCodeByCode(code: string) {
    return this.withFallback(
      () =>
        this.prisma.inviteCode.findUnique({
          where: { code },
        }),
      () =>
        Promise.resolve(
          this.normalizeInviteCode(this.memoryStore.getInviteCodeByCode(code)),
        ),
    );
  }

  private normalizeInviteCode(
    record:
      | {
          id: string;
          code: string;
          status: string;
          usageLimit: number;
          usedCount: number;
          expiresAt?: Date | null;
          createdAt: Date;
        }
      | null
      | undefined,
  ): InviteCodeRecord | null {
    if (!record) {
      return null;
    }

    return {
      ...record,
      expiresAt: record.expiresAt ?? null,
    };
  }

  private generateInviteCode() {
    return `AITRPG-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private async ensureSeedInviteCodes() {
    if (this.seedPromise) {
      return this.seedPromise;
    }

    this.seedPromise = this.seedInviteCodes();
    return this.seedPromise;
  }

  private async seedInviteCodes() {
    const seedCodes = (this.configService.get<string>('INVITE_CODE_SEEDS') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!seedCodes.length) {
      return;
    }

    if (this.configService.get<string>('DATA_STORE_MODE') === 'file') {
      seedCodes.forEach((code) => this.memoryStore.upsertSeedInviteCode(code));
      return;
    }

    try {
      for (const code of seedCodes) {
        const existing = await this.prisma.inviteCode.findUnique({
          where: { code },
          select: { id: true },
        });

        if (!existing) {
          await this.prisma.inviteCode.create({
            data: {
              code,
              usageLimit: 1,
            },
          });
        }
      }
    } catch (error) {
      if (isPrimaryStoreUnavailable(error)) {
        seedCodes.forEach((code) => this.memoryStore.upsertSeedInviteCode(code));
        return;
      }

      throw error;
    }
  }

  private async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
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
      if (isPrimaryStoreUnavailable(error)) {
        return fallback();
      }

      throw error;
    }
  }
}
