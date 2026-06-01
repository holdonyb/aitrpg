import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { reviewReportInputSchema } from '@aitrpg/shared';

import { InviteCodesService } from './invite-codes/invite-codes.service';
import { PrismaService } from './prisma/prisma.service';
import { isPrimaryStoreUnavailable } from './store/fallback';
import { MemoryStoreService } from './store/memory-store.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly memoryStore: MemoryStoreService,
    private readonly inviteCodesService: InviteCodesService,
  ) {}

  getSystemStatus() {
    return {
      product: 'AITRPG',
      authMode: 'email-code',
      roomSurface: 'text-live',
      asyncMedia: ['portrait', 'illustration', 'novel', 'video'],
    };
  }

  async getHealthSnapshot() {
    const storeMode = this.configService.get<string>('DATA_STORE_MODE') ?? 'prisma';
    const emailMode = this.configService.get<string>('EMAIL_DELIVERY_MODE') ?? 'debug';

    const stats = await this.withFallback(
      async () => {
        const [
        users,
        campaigns,
        rooms,
        events,
        portraits,
        inviteCodes,
        mediaJobs,
        reviewReports,
        reviewRuns,
      ] = await Promise.all([
          this.prisma.user.count(),
          this.prisma.campaign.count(),
          this.prisma.room.count(),
          this.prisma.storyEvent.count(),
          this.prisma.portraitAsset.count(),
          this.prisma.inviteCode.count(),
          this.prisma.mediaJob.findMany({ select: { status: true } }),
          this.prisma.reviewReport.count(),
          this.prisma.reviewRun.count(),
        ]);
        return {
          users,
          campaigns,
          rooms,
          events,
          portraits,
          inviteCodes,
          mediaJobs,
          reviewReports,
          reviewRuns,
        };
      },
      async () => ({
        users: this.memoryStore.countUsers(),
        campaigns: this.memoryStore.countCampaigns(),
        rooms: this.memoryStore.countRooms(),
        events: this.memoryStore.countStoryEvents(),
        portraits: this.memoryStore.countPortraitAssets(),
        inviteCodes: (await this.inviteCodesService.listInviteCodes()).length,
        mediaJobs: this.memoryStore
          .listAllMediaJobs()
          .map((job) => ({ status: job.status })),
        reviewReports: this.memoryStore.countReviewReports(),
        reviewRuns: this.memoryStore.countReviewRuns(),
      }),
    );

    const byStatus = stats.mediaJobs.reduce<Record<string, number>>(
      (accumulator, job) => {
        accumulator[job.status] = (accumulator[job.status] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    return {
      product: 'AITRPG',
      generatedAt: new Date().toISOString(),
      storeMode,
      checks: {
        api: 'ok',
        database: storeMode === 'file' ? 'file-store' : 'ok',
        email: emailMode,
        mediaWorker: 'inline',
      },
      totals: {
        users: stats.users,
        campaigns: stats.campaigns,
        rooms: stats.rooms,
        events: stats.events,
        portraits: stats.portraits,
        inviteCodes: stats.inviteCodes,
        reviewReports: stats.reviewReports,
        reviewRuns: stats.reviewRuns,
      },
      jobs: {
        total: stats.mediaJobs.length,
        byStatus,
      },
    };
  }

  async listReviewReports() {
    return this.withFallback(
      () =>
        this.prisma.reviewReport.findMany({
          orderBy: { createdAt: 'desc' },
        }),
      () =>
        Promise.resolve(
          this.memoryStore.listReviewReports().map((report) =>
            this.normalizeReviewReport(report),
          ),
        ),
    );
  }

  async createReviewReport(userId: string, body: unknown) {
    const input = reviewReportInputSchema.parse(body);

    await this.assertReviewTargetExists(input.targetType, input.targetId);

    return this.withFallback(
      () =>
        this.prisma.reviewReport.create({
          data: {
            createdBy: userId,
            scope: input.scope,
            reviewerLabel: input.reviewerLabel,
            status: input.status,
            targetType: input.targetType,
            targetId: input.targetId,
            resolutionStatus: 'OPEN',
            reviewRunId: input.reviewRunId,
            summary: input.summary,
            findings: input.findings,
          },
        }),
      () =>
        Promise.resolve(
          this.normalizeReviewReport(
            this.memoryStore.createReviewReport({
              createdBy: userId,
              scope: input.scope,
              reviewerLabel: input.reviewerLabel,
              status: input.status,
              targetType: input.targetType,
              targetId: input.targetId,
              resolutionStatus: 'OPEN',
              reviewRunId: input.reviewRunId,
              summary: input.summary,
              findings: input.findings,
            }),
          ),
        ),
    );
  }

  async resolveReviewReport(reviewReportId: string) {
    return this.withFallback(
      () =>
        this.prisma.reviewReport.update({
          where: { id: reviewReportId },
          data: {
            resolutionStatus: 'RESOLVED',
            resolvedAt: new Date(),
          },
        }),
      async () => {
        const report = this.memoryStore.updateReviewReportResolution(
          reviewReportId,
          'RESOLVED',
        );
        if (!report) {
          throw new NotFoundException('Review report not found');
        }
        return this.normalizeReviewReport(report);
      },
    );
  }

  async listInviteCodes() {
    return this.inviteCodesService.listInviteCodes();
  }

  async createInviteCode(body: unknown) {
    return this.inviteCodesService.createInviteCode(body);
  }

  async disableInviteCode(inviteCodeId: string) {
    return this.inviteCodesService.disableInviteCode(inviteCodeId);
  }

  async assertReviewTargetExists(
    targetType: 'SYSTEM' | 'ROOM' | 'ARTIFACT',
    targetId?: string,
  ) {
    if (targetType === 'SYSTEM') {
      return;
    }

    if (!targetId) {
      throw new BadRequestException('Review target id is required');
    }

    const exists = await this.withFallback(
      async () => {
        if (targetType === 'ROOM') {
          return Boolean(
            await this.prisma.room.findUnique({
              where: { id: targetId },
              select: { id: true },
            }),
          );
        }

        return Boolean(
          await this.prisma.mediaJob.findUnique({
            where: { id: targetId },
            select: { id: true },
          }),
        );
      },
      async () => {
        if (targetType === 'ROOM') {
          return Boolean(this.memoryStore.getRoom(targetId));
        }

        return Boolean(this.memoryStore.getMediaJob(targetId));
      },
    );

    if (!exists) {
      throw new NotFoundException('Review target not found');
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

  private normalizeReviewReport<
    T extends {
      targetId?: string | null;
      resolvedAt?: Date | null;
      reviewRunId?: string | null;
    },
  >(
    report: T,
  ) {
    return {
      ...report,
      targetId: report.targetId ?? null,
      reviewRunId:
        'reviewRunId' in report ? (report.reviewRunId ?? null) : null,
      resolvedAt: report.resolvedAt ?? null,
    };
  }
}
