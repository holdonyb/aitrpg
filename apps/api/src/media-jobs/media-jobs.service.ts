import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { MemoryStoreService } from '../store/memory-store.service';

@Injectable()
export class MediaJobsService implements OnModuleInit {
  private readonly logger = new Logger(MediaJobsService.name);
  private readonly inflightJobIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryStore: MemoryStoreService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const resumableJobs = await this.withFallback(
      () =>
        this.prisma.mediaJob.findMany({
          where: {
            status: {
              in: ['queued', 'running', 'retryable'],
            },
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        }),
      () =>
        Promise.resolve(
          this.memoryStore
            .listAllMediaJobs()
            .filter((job) =>
              ['queued', 'running', 'retryable'].includes(job.status),
            )
            .map((job) => ({ id: job.id })),
        ),
    );

    resumableJobs.forEach((job) => this.enqueue(job.id));
  }

  enqueue(jobId: string) {
    if (this.inflightJobIds.has(jobId)) {
      return;
    }

    this.inflightJobIds.add(jobId);
    setTimeout(() => {
      void this.process(jobId).finally(() => {
        this.inflightJobIds.delete(jobId);
      });
    }, 25);
  }

  private async process(jobId: string) {
    const job = await this.withFallback(
      () =>
        this.prisma.mediaJob.findUnique({
          where: { id: jobId },
        }),
      () => Promise.resolve(this.memoryStore.getMediaJob(jobId) ?? null),
    );

    if (!job || job.status === 'succeeded') {
      return;
    }

    await this.withFallback(
      () =>
        this.prisma.mediaJob.update({
          where: { id: jobId },
          data: {
            status: 'running',
          },
        }),
      () =>
        Promise.resolve(
          this.memoryStore.updateMediaJobStatus(jobId, 'running'),
        ),
    );

    try {
      await new Promise((resolve) => setTimeout(resolve, 75));

      await this.withFallback(
        () =>
          this.prisma.mediaJob.update({
            where: { id: jobId },
            data: {
              status: 'succeeded',
            },
          }),
        () =>
          Promise.resolve(
            this.memoryStore.updateMediaJobStatus(jobId, 'succeeded'),
          ),
      );
    } catch (error) {
      this.logger.error(`Media job ${jobId} failed`, error as Error);
      await this.withFallback(
        () =>
          this.prisma.mediaJob.update({
            where: { id: jobId },
            data: {
              status: 'retryable',
            },
          }),
        () =>
          Promise.resolve(
            this.memoryStore.updateMediaJobStatus(jobId, 'retryable'),
          ),
      );
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
    } catch {
      return fallback();
    }
  }
}
