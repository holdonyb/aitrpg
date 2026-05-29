import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";

type User = {
  id: string;
  email: string;
  displayName: string;
};

type EmailCodeRecord = {
  email: string;
  code: string;
  expiresAt: number;
};

type Campaign = {
  id: string;
  ownerId: string;
  title: string;
  pitch: string;
  worldTemplate: string;
  tone: string;
  createdAt: string;
};

type Character = {
  id: string;
  campaignId: string;
  name: string;
  ancestry: string;
  className: string;
  background: string;
  personality: string;
  controlledBy: string;
};

type Room = {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  status: string;
  createdBy: string;
  visibility: "PRIVATE" | "LINK" | "PUBLIC";
  passwordHash?: string;
  spectatorCommentEnabled: boolean;
  createdAt: string;
};

type StoryEvent = {
  id: string;
  roomId: string;
  characterId?: string;
  type: string;
  content: string;
  createdAt: string;
};

type MediaJob = {
  id: string;
  roomId: string;
  type: string;
  title: string;
  prompt: string;
  status: string;
  createdAt: string;
};

type ShareLink = {
  id: string;
  targetType: "ROOM" | "ARTIFACT";
  targetId: string;
  token: string;
  createdBy: string;
  revokedAt?: string;
  createdAt: string;
};

type SpectatorComment = {
  id: string;
  roomId: string;
  userId: string;
  userDisplayName: string;
  content: string;
  createdAt: string;
};

@Injectable()
export class MemoryStoreService {
  private readonly users = new Map<string, User>();
  private readonly userByEmail = new Map<string, User>();
  private readonly emailCodes = new Map<string, EmailCodeRecord>();
  private readonly campaigns = new Map<string, Campaign>();
  private readonly characters = new Map<string, Character>();
  private readonly rooms = new Map<string, Room>();
  private readonly events = new Map<string, StoryEvent[]>();
  private readonly mediaJobs = new Map<string, MediaJob[]>();
  private readonly shareLinks = new Map<string, ShareLink>();
  private readonly shareLinksByTarget = new Map<string, ShareLink>();
  private readonly spectatorComments = new Map<string, SpectatorComment[]>();
  private readonly roomAccessTokens = new Set<string>();

  saveCode(email: string, code: string) {
    this.emailCodes.set(email, {
      email,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  }

  verifyCode(email: string, code: string) {
    const record = this.emailCodes.get(email);
    if (!record) {
      return false;
    }

    if (record.code !== code || record.expiresAt < Date.now()) {
      return false;
    }

    this.emailCodes.delete(email);
    return true;
  }

  findOrCreateUser(email: string) {
    const existing = this.userByEmail.get(email);
    if (existing) {
      return existing;
    }

    const user: User = {
      id: randomUUID(),
      email,
      displayName: email.split("@")[0],
    };

    this.users.set(user.id, user);
    this.userByEmail.set(email, user);
    return user;
  }

  getUser(userId: string) {
    return this.users.get(userId);
  }

  createCampaign(ownerId: string, input: Omit<Campaign, "id" | "ownerId" | "createdAt">) {
    const campaign: Campaign = {
      id: randomUUID(),
      ownerId,
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  listCampaigns(ownerId: string) {
    return [...this.campaigns.values()].filter((campaign) => campaign.ownerId === ownerId);
  }

  createCharacter(input: Character) {
    this.characters.set(input.id, input);
    return input;
  }

  listCharacters(campaignId: string) {
    return [...this.characters.values()].filter((character) => character.campaignId === campaignId);
  }

  createRoom(input: Omit<Room, "id" | "createdAt" | "passwordHash"> & { password?: string }) {
    const room: Room = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      passwordHash: input.password ? this.hashSecret(input.password) : undefined,
      ...input,
    };
    delete (room as Room & { password?: string }).password;
    this.rooms.set(room.id, room);
    return room;
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  addEvent(event: Omit<StoryEvent, "id" | "createdAt">) {
    const record: StoryEvent = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...event,
    };
    const items = this.events.get(event.roomId) ?? [];
    items.push(record);
    this.events.set(event.roomId, items);
    return record;
  }

  listEvents(roomId: string) {
    return this.events.get(roomId) ?? [];
  }

  addMediaJob(job: Omit<MediaJob, "id" | "status" | "createdAt">) {
    const record: MediaJob = {
      id: randomUUID(),
      status: "queued",
      createdAt: new Date().toISOString(),
      ...job,
    };
    const items = this.mediaJobs.get(job.roomId) ?? [];
    items.push(record);
    this.mediaJobs.set(job.roomId, items);
    return record;
  }

  listMediaJobs(roomId: string) {
    return this.mediaJobs.get(roomId) ?? [];
  }

  createShareLink(input: Omit<ShareLink, "id" | "createdAt">) {
    const key = `${input.targetType}:${input.targetId}`;
    const existing = this.shareLinksByTarget.get(key);
    if (existing && !existing.revokedAt) {
      return existing;
    }

    const record: ShareLink = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.shareLinks.set(record.token, record);
    this.shareLinksByTarget.set(key, record);
    return record;
  }

  getShareLink(token: string) {
    return this.shareLinks.get(token);
  }

  grantShareAccess(token: string) {
    this.roomAccessTokens.add(token);
    return {
      ok: true,
    };
  }

  hasShareAccess(token: string) {
    return this.roomAccessTokens.has(token);
  }

  addSpectatorComment(roomId: string, userId: string, userDisplayName: string, content: string) {
    const record: SpectatorComment = {
      id: randomUUID(),
      roomId,
      userId,
      userDisplayName,
      content,
      createdAt: new Date().toISOString(),
    };
    const items = this.spectatorComments.get(roomId) ?? [];
    items.push(record);
    this.spectatorComments.set(roomId, items);
    return record;
  }

  listSpectatorComments(roomId: string) {
    return this.spectatorComments.get(roomId) ?? [];
  }

  private hashSecret(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  verifyRoomPassword(room: Room, password?: string) {
    if (!room.passwordHash) {
      return true;
    }

    if (!password) {
      return false;
    }

    return this.hashSecret(password) === room.passwordHash;
  }
}
