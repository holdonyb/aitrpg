import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  mediaJobInputSchema,
  roomInputSchema,
  shareAccessInputSchema,
  shareLinkInputSchema,
  spectatorCommentInputSchema,
  storyEventInputSchema,
} from '@aitrpg/shared';
import { createHash, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

import { MediaJobsService } from '../media-jobs/media-jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryStoreService } from '../store/memory-store.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mediaJobsService: MediaJobsService,
    private readonly memoryStore: MemoryStoreService,
  ) {}

  async createRoom(userId: string, body: unknown) {
    const input = roomInputSchema.parse(body);
    const room = await this.withFallback(
      () =>
        this.prisma.room.create({
          data: {
            campaignId: input.campaignId,
            title: input.title,
            description: input.description,
            status: 'READY',
            createdBy: userId,
            visibility: input.visibility,
            passwordHash: input.password
              ? this.hashSecret(input.password)
              : undefined,
            spectatorCommentEnabled: input.spectatorCommentEnabled,
          },
        }),
      () =>
        this.memoryStore.createRoom({
          campaignId: input.campaignId,
          title: input.title,
          description: input.description,
          status: 'READY',
          createdBy: userId,
          visibility: input.visibility,
          password: input.password,
          spectatorCommentEnabled: input.spectatorCommentEnabled,
        }) as any,
    );

    return this.sanitizeRoom(room);
  }

  async getLedger(roomId: string) {
    await this.ensureRoom(roomId);

    const [events, jobs] = await this.withFallback(
      () =>
        Promise.all([
          this.prisma.storyEvent.findMany({
            where: { roomId },
            orderBy: { createdAt: 'asc' },
          }),
          this.prisma.mediaJob.findMany({
            where: { roomId },
            orderBy: { createdAt: 'asc' },
          }),
        ]),
      () =>
        Promise.resolve([
          this.memoryStore.listEvents(roomId),
          this.memoryStore.listMediaJobs(roomId),
        ]) as any,
    );

    return {
      roomId,
      events,
      jobs,
    };
  }

  async listRooms(userId: string, campaignId?: string) {
    const rooms = (await this.withFallback(
      () =>
        this.prisma.room.findMany({
          where: {
            createdBy: userId,
            ...(campaignId ? { campaignId } : {}),
          },
          orderBy: { createdAt: 'desc' },
        }),
      () => this.memoryStore.listRooms(userId, campaignId) as any,
    )) as Array<{
      id: string;
      campaignId: string;
      title: string;
      description: string;
      status: string;
      createdBy: string;
      visibility: string;
      spectatorCommentEnabled: boolean;
      createdAt: Date | string;
    }>;

    return rooms.map((room) => this.sanitizeRoom(room));
  }

  async getRoom(userId: string, roomId: string) {
    const room = await this.ensureRoom(roomId);
    if (room.createdBy !== userId) {
      throw new ForbiddenException('Only the DM can inspect this room');
    }

    return this.sanitizeRoom(room);
  }

  async addEvent(body: unknown) {
    const input = storyEventInputSchema.parse(body);
    await this.ensureRoom(input.roomId);

    return this.withFallback(
      () =>
        this.prisma.storyEvent.create({
          data: input,
        }),
      () => this.memoryStore.addEvent(input) as any,
    );
  }

  async getSuggestions(roomId: string) {
    await this.ensureRoom(roomId);

    const recent = await this.prisma.storyEvent.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    const lastContent = recent.at(0)?.content ?? '新的场景正在展开。';

    return {
      roomId,
      suggestions: [
        `旁白建议：${lastContent} 之后，环境细节可以进一步压迫队伍情绪。`,
        'NPC 建议：让营地外的斥候带回一条真假难辨的坏消息。',
        '推进建议：给 DM 一个需要立刻裁定的选择节点。',
      ],
    };
  }

  async createMediaJob(roomId: string, body: Record<string, unknown>) {
    const input = mediaJobInputSchema.parse({
      ...body,
      roomId,
    });
    await this.ensureRoom(roomId);

    const job = await this.withFallback(
      () =>
        this.prisma.mediaJob.create({
          data: {
            roomId: input.roomId,
            type: input.type,
            title: input.title,
            prompt: input.prompt,
            status: 'queued',
          },
        }),
      () =>
        this.memoryStore.addMediaJob({
          roomId: input.roomId,
          type: input.type,
          title: input.title,
          prompt: input.prompt,
        }) as any,
    );

    this.mediaJobsService.enqueue(job.id);

    return job;
  }

  async createShareLink(userId: string, roomId: string, body: unknown) {
    const input = shareLinkInputSchema.parse(body);
    const room = await this.ensureRoom(roomId);
    if (room.createdBy !== userId) {
      throw new ForbiddenException('Only the DM can create a share link');
    }

    return this.withFallback(
      async () => {
        const existing = await this.prisma.shareLink.findFirst({
          where: {
            targetType: input.targetType,
            targetId: roomId,
            revokedAt: null,
          },
        });

        if (existing) {
          return existing;
        }

        return this.prisma.shareLink.create({
          data: {
            targetType: input.targetType,
            targetId: roomId,
            token: randomUUID().replaceAll('-', ''),
            createdBy: userId,
          },
        });
      },
      () =>
        this.memoryStore.createShareLink({
          targetType: input.targetType,
          targetId: roomId,
          token: randomUUID().replaceAll('-', ''),
          createdBy: userId,
        }) as any,
    );
  }

  async createArtifactShareLink(
    userId: string,
    artifactId: string,
    body: unknown,
  ) {
    const input = shareLinkInputSchema.parse(body);
    const artifact = await this.withFallback(
      () =>
        this.prisma.mediaJob.findUnique({
          where: { id: artifactId },
          include: {
            room: true,
          },
        }),
      () => {
        const job = this.memoryStore.getMediaJob(artifactId);
        if (!job) {
          return null;
        }

        const room = this.memoryStore.getRoom(job.roomId);
        if (!room) {
          return null;
        }

        return { ...job, room } as any;
      },
    );

    if (!artifact) {
      throw new NotFoundException('Artifact not found');
    }

    if (artifact.room.createdBy !== userId) {
      throw new ForbiddenException('Only the DM can share this artifact');
    }

    return this.withFallback(
      async () => {
        const existing = await this.prisma.shareLink.findFirst({
          where: {
            targetType: input.targetType,
            targetId: artifactId,
            revokedAt: null,
          },
        });

        if (existing) {
          return existing;
        }

        return this.prisma.shareLink.create({
          data: {
            targetType: input.targetType,
            targetId: artifactId,
            token: randomUUID().replaceAll('-', ''),
            createdBy: userId,
          },
        });
      },
      () =>
        this.memoryStore.createShareLink({
          targetType: input.targetType,
          targetId: artifactId,
          token: randomUUID().replaceAll('-', ''),
          createdBy: userId,
        }) as any,
    );
  }

  async getSharedRoom(token: string, accessToken?: string) {
    const shareLink = await this.ensureRoomShareLink(token);
    const room = await this.ensureRoom(shareLink.targetId);
    const hasAccess = this.hasRoomShareAccess(
      room.passwordHash,
      token,
      accessToken,
    );
    const events = hasAccess
      ? await this.withFallback(
          () =>
            this.prisma.storyEvent.findMany({
              where: { roomId: room.id },
              orderBy: { createdAt: 'asc' },
            }),
          () => this.memoryStore.listEvents(room.id) as any,
        )
      : [];

    return {
      share: {
        token: shareLink.token,
        targetType: shareLink.targetType,
      },
      room: this.sanitizeRoom(room),
      requiresPassword: Boolean(room.passwordHash),
      accessGranted: hasAccess,
      events,
    };
  }

  async accessSharedRoom(token: string, body: unknown) {
    const input = shareAccessInputSchema.parse(body);
    const shareLink = await this.ensureRoomShareLink(token);
    const room = await this.ensureRoom(shareLink.targetId);

    if (!this.verifyRoomPassword(room.passwordHash, input.password)) {
      throw new UnauthorizedException('Invalid room password');
    }

    return {
      ok: true,
      accessToken: this.issueRoomShareAccessToken(token),
    };
  }

  async getSharedArtifact(token: string) {
    const shareLink = await this.ensureArtifactShareLink(token);
    const artifact = await this.withFallback(
      () =>
        this.prisma.mediaJob.findUnique({
          where: { id: shareLink.targetId },
        }),
      () => (this.memoryStore.getMediaJob(shareLink.targetId) ?? null) as any,
    );

    if (!artifact) {
      throw new NotFoundException('Artifact not found');
    }

    return {
      share: {
        token: shareLink.token,
        targetType: shareLink.targetType,
      },
      artifact: {
        id: artifact.id,
        roomId: artifact.roomId,
        type: artifact.type,
        title: artifact.title,
        prompt: artifact.prompt,
        status: artifact.status,
        createdAt: artifact.createdAt,
      },
    };
  }

  async listSpectatorComments(token: string, accessToken?: string) {
    const shareLink = await this.ensureRoomShareLink(token);
    const room = await this.ensureRoom(shareLink.targetId);

    if (!this.hasRoomShareAccess(room.passwordHash, token, accessToken)) {
      throw new UnauthorizedException('Share access required');
    }

    const comments = await this.withFallback(
      () =>
        this.prisma.spectatorComment.findMany({
          where: { roomId: room.id },
          orderBy: { createdAt: 'asc' },
        }),
      () => this.memoryStore.listSpectatorComments(room.id) as any,
    );

    return {
      roomId: room.id,
      comments,
    };
  }

  async createSpectatorComment(
    token: string,
    userId: string,
    userDisplayName: string,
    accessToken: string | undefined,
    body: unknown,
  ) {
    const input = spectatorCommentInputSchema.parse(body);
    const shareLink = await this.ensureRoomShareLink(token);
    const room = await this.ensureRoom(shareLink.targetId);

    if (!this.hasRoomShareAccess(room.passwordHash, token, accessToken)) {
      throw new UnauthorizedException('Share access required');
    }

    if (!room.spectatorCommentEnabled) {
      throw new ForbiddenException('Spectator comments are disabled');
    }

    return this.withFallback(
      () =>
        this.prisma.spectatorComment.create({
          data: {
            roomId: room.id,
            userId,
            userDisplayName,
            content: input.content,
          },
        }),
      () =>
        this.memoryStore.addSpectatorComment(
          room.id,
          userId,
          userDisplayName,
          input.content,
        ) as any,
    );
  }

  private async ensureRoom(roomId: string) {
    const room = await this.withFallback(
      () =>
        this.prisma.room.findUnique({
          where: { id: roomId },
        }),
      () => this.memoryStore.getRoom(roomId) as any,
    );
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  private async ensureRoomShareLink(token: string) {
    const shareLink = await this.withFallback(
      () =>
        this.prisma.shareLink.findUnique({
          where: { token },
        }),
      () => this.memoryStore.getShareLink(token) as any,
    );
    if (!shareLink || shareLink.targetType !== 'ROOM' || shareLink.revokedAt) {
      throw new NotFoundException('Share link not found');
    }

    return shareLink;
  }

  private async ensureArtifactShareLink(token: string) {
    const shareLink = await this.withFallback(
      () =>
        this.prisma.shareLink.findUnique({
          where: { token },
        }),
      () => this.memoryStore.getShareLink(token) as any,
    );

    if (
      !shareLink ||
      shareLink.targetType !== 'ARTIFACT' ||
      shareLink.revokedAt
    ) {
      throw new NotFoundException('Share link not found');
    }

    return shareLink;
  }

  private hashSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private verifyRoomPassword(passwordHash: string | null, password?: string) {
    if (!passwordHash) {
      return true;
    }

    if (!password) {
      return false;
    }

    return this.hashSecret(password) === passwordHash;
  }

  private issueRoomShareAccessToken(shareToken: string) {
    const secret =
      this.configService.get<string>('JWT_SECRET') || 'aitrpg-dev-secret';

    return jwt.sign(
      {
        purpose: 'room-share-access',
        shareToken,
      },
      secret,
      {
        expiresIn: '12h',
      },
    );
  }

  private hasRoomShareAccess(
    passwordHash: string | null,
    shareToken: string,
    accessToken?: string,
  ) {
    if (!passwordHash) {
      return true;
    }

    if (!accessToken) {
      return false;
    }

    try {
      const secret =
        this.configService.get<string>('JWT_SECRET') || 'aitrpg-dev-secret';
      const payload = jwt.verify(accessToken, secret) as {
        purpose?: string;
        shareToken?: string;
      };

      return (
        payload.purpose === 'room-share-access' &&
        payload.shareToken === shareToken
      );
    } catch {
      return false;
    }
  }

  private sanitizeRoom(room: {
    id: string;
    campaignId: string;
    title: string;
    description: string;
    status: string;
    createdBy: string;
    visibility: string;
    spectatorCommentEnabled: boolean;
    createdAt: Date | string;
  }) {
    return {
      id: room.id,
      campaignId: room.campaignId,
      title: room.title,
      description: room.description,
      status: room.status,
      createdBy: room.createdBy,
      visibility: room.visibility,
      spectatorCommentEnabled: room.spectatorCommentEnabled,
      createdAt: room.createdAt,
    };
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
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      return fallback();
    }
  }
}
