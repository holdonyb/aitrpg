import { Injectable, NotFoundException } from "@nestjs/common";
import {
  mediaJobInputSchema,
  roomInputSchema,
  storyEventInputSchema,
} from "@aitrpg/shared";

import { MemoryStoreService } from "../store/memory-store.service";

@Injectable()
export class RoomsService {
  constructor(private readonly store: MemoryStoreService) {}

  createRoom(userId: string, body: unknown) {
    const input = roomInputSchema.parse(body);
    return this.store.createRoom({
      ...input,
      createdBy: userId,
      status: "READY",
    });
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

  private ensureRoom(roomId: string) {
    const room = this.store.getRoom(roomId);
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    return room;
  }
}
