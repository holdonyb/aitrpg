import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  mediaJobInputSchema,
  roomInputSchema,
  shareAccessInputSchema,
  shareLinkInputSchema,
  spectatorCommentInputSchema,
  storyEventInputSchema,
} from "@aitrpg/shared";
import { randomUUID } from "crypto";

import { MemoryStoreService } from "../store/memory-store.service";

@Injectable()
export class RoomsService {
  constructor(private readonly store: MemoryStoreService) {}

  createRoom(userId: string, body: unknown) {
    const input = roomInputSchema.parse(body);
    const room = this.store.createRoom({
      ...input,
      createdBy: userId,
      status: "READY",
    });

    return this.sanitizeRoom(room);
  }

  getLedger(roomId: string) {
    this.ensureRoom(roomId);
    return {
      roomId,
      events: this.store.listEvents(roomId),
      jobs: this.store.listMediaJobs(roomId),
    };
  }

  addEvent(body: unknown) {
    const input = storyEventInputSchema.parse(body);
    this.ensureRoom(input.roomId);
    return this.store.addEvent(input);
  }

  getSuggestions(roomId: string) {
    this.ensureRoom(roomId);
    const recent = this.store.listEvents(roomId).slice(-3);
    const lastContent = recent.at(-1)?.content ?? "新的场景正在展开。";

    return {
      roomId,
      suggestions: [
        `旁白建议：${lastContent} 之后，环境细节可以进一步压迫队伍情绪。`,
        "NPC 建议：让营地外的斥候带回一条真假难辨的坏消息。",
        "推进建议：给 DM 一个需要立刻裁定的选择节点。",
      ],
    };
  }

  createMediaJob(roomId: string, body: Record<string, unknown>) {
    const input = mediaJobInputSchema.parse({
      ...body,
      roomId,
    });
    this.ensureRoom(roomId);
    return this.store.addMediaJob(input);
  }

  createShareLink(userId: string, roomId: string, body: unknown) {
    const input = shareLinkInputSchema.parse(body);
    const room = this.ensureRoom(roomId);
    if (room.createdBy !== userId) {
      throw new ForbiddenException("Only the DM can create a share link");
    }

    return this.store.createShareLink({
      targetType: input.targetType,
      targetId: roomId,
      token: randomUUID().replaceAll("-", ""),
      createdBy: userId,
    });
  }

  getSharedRoom(token: string) {
    const shareLink = this.ensureRoomShareLink(token);
    const room = this.ensureRoom(shareLink.targetId);

    return {
      share: {
        token: shareLink.token,
        targetType: shareLink.targetType,
      },
      room: {
        ...this.sanitizeRoom(room),
      },
      requiresPassword: Boolean(room.passwordHash),
      events: this.store.listEvents(room.id),
    };
  }

  accessSharedRoom(token: string, body: unknown) {
    const input = shareAccessInputSchema.parse(body);
    const shareLink = this.ensureRoomShareLink(token);
    const room = this.ensureRoom(shareLink.targetId);

    if (!this.store.verifyRoomPassword(room, input.password)) {
      throw new UnauthorizedException("Invalid room password");
    }

    return this.store.grantShareAccess(token);
  }

  listSpectatorComments(token: string) {
    const shareLink = this.ensureRoomShareLink(token);
    const room = this.ensureRoom(shareLink.targetId);

    return {
      roomId: room.id,
      comments: this.store.listSpectatorComments(room.id),
    };
  }

  createSpectatorComment(token: string, userId: string, userDisplayName: string, body: unknown) {
    const input = spectatorCommentInputSchema.parse(body);
    const shareLink = this.ensureRoomShareLink(token);
    const room = this.ensureRoom(shareLink.targetId);

    if (!room.spectatorCommentEnabled) {
      throw new ForbiddenException("Spectator comments are disabled");
    }

    return this.store.addSpectatorComment(room.id, userId, userDisplayName, input.content);
  }

  private ensureRoom(roomId: string) {
    const room = this.store.getRoom(roomId);
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    return room;
  }

  private ensureRoomShareLink(token: string) {
    const shareLink = this.store.getShareLink(token);
    if (!shareLink || shareLink.targetType !== "ROOM" || shareLink.revokedAt) {
      throw new NotFoundException("Share link not found");
    }

    return shareLink;
  }

  private sanitizeRoom(room: {
    id: string;
    campaignId: string;
    title: string;
    description: string;
    status: string;
    createdBy: string;
    visibility: "PRIVATE" | "LINK" | "PUBLIC";
    spectatorCommentEnabled: boolean;
    createdAt: string;
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
}
