import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { reviewRunInputSchema } from '@aitrpg/shared';

import { AppService } from '../app.service';
import { PrismaService } from '../prisma/prisma.service';
import { isPrimaryStoreUnavailable } from '../store/fallback';
import { MemoryStoreService } from '../store/memory-store.service';
import { normalizeReviewRun } from './review-run-normalize';

@Injectable()
export class ReviewRunsService {
  private readonly logger = new Logger(ReviewRunsService.name);
  private readonly inflightRunIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryStore: MemoryStoreService,
    private readonly appService: AppService,
  ) {}

  async listRuns() {
    const runs = await this.withFallback<
      Array<{
        id: string;
        createdBy: string;
        scope: string;
        reviewerLabel: string;
        targetType: string;
        targetId: string | null;
        brief: string;
        status: string;
        summary: string | null;
        createdAt: Date;
        completedAt: Date | null;
        reports: Array<{ id: string }>;
      }>
    >(
      () =>
        this.prisma.reviewRun.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            reports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true },
            },
          },
        }),
      () =>
        Promise.resolve(
          this.memoryStore.listReviewRuns().map((run) => {
            const latestReport = this.memoryStore.getLatestReviewReportForRun(run.id);
            return {
              ...run,
              targetId: run.targetId ?? null,
              summary: run.summary ?? null,
              completedAt: run.completedAt ?? null,
              reports: latestReport ? [{ id: latestReport.id }] : [],
            };
          }),
        ),
    );

    return Promise.all(runs.map((run) => this.decorateRun(run)));
  }

  async createRun(userId: string, body: unknown) {
    const input = reviewRunInputSchema.parse(body);
    await this.appService.assertReviewTargetExists(input.targetType, input.targetId);

    const run = await this.withFallback(
      () =>
        this.prisma.reviewRun.create({
          data: {
            createdBy: userId,
            scope: input.scope,
            reviewerLabel: input.reviewerLabel,
            targetType: input.targetType,
            targetId: input.targetId,
            brief: input.brief,
            status: 'queued',
          },
        }),
      () =>
        Promise.resolve(
          normalizeReviewRun(
            this.memoryStore.createReviewRun({
              createdBy: userId,
              scope: input.scope,
              reviewerLabel: input.reviewerLabel,
              targetType: input.targetType,
              targetId: input.targetId,
              brief: input.brief,
              status: 'queued',
            }),
          ),
        ),
    );

    this.enqueue(run.id);
    return this.decorateRun({ ...run, reports: [] });
  }

  enqueue(reviewRunId: string) {
    if (this.inflightRunIds.has(reviewRunId)) {
      return;
    }

    this.inflightRunIds.add(reviewRunId);
    setTimeout(() => {
      void this.process(reviewRunId).finally(() => {
        this.inflightRunIds.delete(reviewRunId);
      });
    }, 50);
  }

  private async process(reviewRunId: string) {
    const run = await this.withFallback(
      () =>
        this.prisma.reviewRun.findUnique({
          where: { id: reviewRunId },
        }),
      () =>
        Promise.resolve(
          this.memoryStore.getReviewRun(reviewRunId)
            ? normalizeReviewRun(this.memoryStore.getReviewRun(reviewRunId)!)
            : null,
        ),
    );

    if (!run) {
      throw new NotFoundException('Review run not found');
    }

    await this.withFallback(
      () =>
        this.prisma.reviewRun.update({
          where: { id: reviewRunId },
          data: { status: 'running' },
        }),
      () =>
        Promise.resolve((() => {
          const next = this.memoryStore.updateReviewRun(reviewRunId, {
            status: 'running',
          });
          return next ? normalizeReviewRun(next) : undefined;
        })()),
    );

    try {
      const health = await this.appService.getHealthSnapshot();
      const targetSnapshot = await this.buildTargetSnapshot(
        run.targetType as 'SYSTEM' | 'ROOM' | 'ARTIFACT',
        run.targetId,
      );
      const findings = [
        `1. 审查目标: ${run.targetType}${run.targetId ? ` / ${run.targetId}` : ''}`,
        `2. 审查简述: ${run.brief}`,
        `3. 当前运行面: 存储=${health.storeMode}, 数据库=${health.checks.database}, 邮件=${health.checks.email}, 媒体执行=${health.checks.mediaWorker}`,
        `4. 当前统计: 战役=${health.totals.campaigns}, 房间=${health.totals.rooms}, 事件=${health.totals.events}, 审查报告=${health.totals.reviewReports}, 审查任务=${health.totals.reviewRuns}`,
        `5. 目标快照:\n${targetSnapshot.findings}`,
      ].join('\n');

      const report = await this.appService.createReviewReport(run.createdBy, {
        scope: run.scope,
        reviewerLabel: run.reviewerLabel,
        status: targetSnapshot.status,
        targetType: run.targetType,
        targetId: run.targetId ?? undefined,
        summary: `${run.scope} automated review completed: ${targetSnapshot.summary}`,
        findings,
        reviewRunId: run.id,
      });

      await this.withFallback(
        () =>
          this.prisma.reviewRun.update({
            where: { id: reviewRunId },
            data: {
              status: 'succeeded',
              summary: report.summary,
              completedAt: new Date(),
            },
          }),
        () =>
          Promise.resolve((() => {
            const next = this.memoryStore.updateReviewRun(reviewRunId, {
              status: 'succeeded',
              summary: report.summary,
              completedAt: new Date(),
            });
            return next ? normalizeReviewRun(next) : undefined;
          })()),
      );
    } catch (error) {
      this.logger.error(`Review run ${reviewRunId} failed`, error as Error);
      await this.withFallback(
        () =>
          this.prisma.reviewRun.update({
            where: { id: reviewRunId },
            data: {
              status: 'failed',
              summary: error instanceof Error ? error.message : 'Review run failed',
              completedAt: new Date(),
            },
          }),
        () =>
          Promise.resolve((() => {
            const next = this.memoryStore.updateReviewRun(reviewRunId, {
              status: 'failed',
              summary: error instanceof Error ? error.message : 'Review run failed',
              completedAt: new Date(),
            });
            return next ? normalizeReviewRun(next) : undefined;
          })()),
      );
    }
  }

  private async decorateRun(
    run: {
      id: string;
      targetType: string;
      targetId?: string | null;
      reports?: Array<{ id: string }>;
      [key: string]: unknown;
    },
  ) {
    const linkedReviewReportId = run.reports?.[0]?.id ?? null;

    if (run.targetType === 'ROOM' && run.targetId) {
      const room = await this.withFallback(
        () =>
          this.prisma.room.findUnique({
            where: { id: run.targetId! },
            select: { id: true, title: true },
          }),
        () => Promise.resolve(this.memoryStore.getRoom(run.targetId!) ?? null),
      );

      return normalizeReviewRun({
        ...run,
        linkedReviewReportId,
        targetLabel: room?.title ?? null,
        targetRoomId: room?.id ?? null,
      });
    }

    if (run.targetType === 'ARTIFACT' && run.targetId) {
      const artifact = await this.withFallback(
        () =>
          this.prisma.mediaJob.findUnique({
            where: { id: run.targetId! },
            select: { id: true, title: true, roomId: true },
          }),
        () => Promise.resolve(this.memoryStore.getMediaJob(run.targetId!) ?? null),
      );

      return normalizeReviewRun({
        ...run,
        linkedReviewReportId,
        targetLabel: artifact?.title ?? null,
        targetRoomId: artifact?.roomId ?? null,
      });
    }

    return normalizeReviewRun({
      ...run,
      linkedReviewReportId,
      targetLabel: run.targetType === 'SYSTEM' ? 'AITRPG System' : null,
      targetRoomId: null,
    });
  }

  private async buildTargetSnapshot(
    targetType: 'SYSTEM' | 'ROOM' | 'ARTIFACT',
    targetId?: string | null,
  ): Promise<{ status: 'pass' | 'fail'; summary: string; findings: string }> {
    if (targetType === 'SYSTEM') {
      return {
        status: 'pass',
        summary: 'system health snapshot captured',
        findings: '系统级审查已记录运行状态与总量统计，可继续结合浏览器层复查。',
      };
    }

    if (targetType === 'ROOM' && targetId) {
      const snapshot = await this.withFallback(
        async () => {
          const room = await this.prisma.room.findUnique({
            where: { id: targetId },
            include: {
              _count: {
                select: {
                  events: true,
                  mediaJobs: true,
                  spectatorComments: true,
                },
              },
            },
          });
          const shareLinkCount = room
            ? await this.prisma.shareLink.count({
                where: {
                  targetType: 'ROOM',
                  targetId,
                  revokedAt: null,
                },
              })
            : 0;
          return room
            ? {
                title: room.title,
                visibility: room.visibility,
                spectatorCommentEnabled: room.spectatorCommentEnabled,
                eventCount: room._count.events,
                mediaJobCount: room._count.mediaJobs,
                spectatorCommentCount: room._count.spectatorComments,
                shareLinkCount,
              }
            : null;
        },
        async () => {
          const room = this.memoryStore.getRoom(targetId);
          if (!room) {
            return null;
          }

          return {
            title: room.title,
            visibility: room.visibility,
            spectatorCommentEnabled: room.spectatorCommentEnabled,
            eventCount: this.memoryStore.listEvents(targetId).length,
            mediaJobCount: this.memoryStore.listMediaJobs(targetId).length,
            spectatorCommentCount: this.memoryStore.listSpectatorComments(targetId).length,
            shareLinkCount: this.memoryStore.countShareLinksForTarget('ROOM', targetId),
          };
        },
      );

      if (!snapshot) {
        return {
          status: 'fail',
          summary: 'room snapshot missing',
          findings: '房间审查失败：目标房间不存在或无法读取。',
        };
      }

      const roomLooksReady =
        snapshot.eventCount > 0 || snapshot.mediaJobCount > 0 || snapshot.shareLinkCount > 0;

      return {
        status: roomLooksReady ? 'pass' : 'fail',
        summary: roomLooksReady
          ? `room "${snapshot.title}" has active ledger/share surface`
          : `room "${snapshot.title}" is still structurally empty`,
        findings: [
          `- 标题: ${snapshot.title}`,
          `- 可见性: ${snapshot.visibility}`,
          `- 观众评论: ${snapshot.spectatorCommentEnabled ? 'enabled' : 'disabled'}`,
          `- Story Ledger 事件数: ${snapshot.eventCount}`,
          `- Afterplay 任务数: ${snapshot.mediaJobCount}`,
          `- 观众评论数: ${snapshot.spectatorCommentCount}`,
          `- Share Link 数: ${snapshot.shareLinkCount}`,
        ].join('\n'),
      };
    }

    if (targetType === 'ARTIFACT' && targetId) {
      const snapshot = await this.withFallback(
        async () => {
          const artifact = await this.prisma.mediaJob.findUnique({
            where: { id: targetId },
            include: {
              room: { select: { title: true } },
            },
          });
          const shareLinkCount = artifact
            ? await this.prisma.shareLink.count({
                where: {
                  targetType: 'ARTIFACT',
                  targetId,
                  revokedAt: null,
                },
              })
            : 0;
          return artifact
            ? {
                title: artifact.title,
                type: artifact.type,
                status: artifact.status,
                roomTitle: artifact.room.title,
                shareLinkCount,
              }
            : null;
        },
        async () => {
          const artifact = this.memoryStore.getMediaJob(targetId);
          if (!artifact) {
            return null;
          }

          const room = this.memoryStore.getRoom(artifact.roomId);
          return {
            title: artifact.title,
            type: artifact.type,
            status: artifact.status,
            roomTitle: room?.title ?? artifact.roomId,
            shareLinkCount: this.memoryStore.countShareLinksForTarget('ARTIFACT', targetId),
          };
        },
      );

      if (!snapshot) {
        return {
          status: 'fail',
          summary: 'artifact snapshot missing',
          findings: '产物审查失败：目标产物不存在或无法读取。',
        };
      }

      const succeeded = snapshot.status === 'succeeded';
      return {
        status: succeeded ? 'pass' : 'fail',
        summary: succeeded
          ? `artifact "${snapshot.title}" is shareable`
          : `artifact "${snapshot.title}" is not ready for sharing`,
        findings: [
          `- 标题: ${snapshot.title}`,
          `- 类型: ${snapshot.type}`,
          `- 状态: ${snapshot.status}`,
          `- 所属房间: ${snapshot.roomTitle}`,
          `- Share Link 数: ${snapshot.shareLinkCount}`,
        ].join('\n'),
      };
    }

    return {
      status: 'fail',
      summary: 'review target input incomplete',
      findings: '审查任务缺少合法目标，无法构建目标快照。',
    };
  }

  private async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
  ) {
    if (process.env.DATA_STORE_MODE === 'file') {
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
