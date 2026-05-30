import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
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
  createdAt: Date;
};

type PortraitAsset = {
  id: string;
  characterId: string;
  prompt: string;
  imageUrl: string;
  status: string;
  createdAt: Date;
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
  portraitAssets: PortraitAsset[];
};

type Room = {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  status: string;
  createdBy: string;
  visibility: 'PRIVATE' | 'LINK' | 'PUBLIC';
  passwordHash?: string;
  spectatorCommentEnabled: boolean;
  createdAt: Date;
};

type StoryEvent = {
  id: string;
  roomId: string;
  characterId?: string;
  type: string;
  content: string;
  createdAt: Date;
};

type MediaJob = {
  id: string;
  roomId: string;
  type: string;
  title: string;
  prompt: string;
  status: string;
  createdAt: Date;
};

type ShareLink = {
  id: string;
  targetType: 'ROOM' | 'ARTIFACT';
  targetId: string;
  token: string;
  createdBy: string;
  revokedAt?: Date;
  createdAt: Date;
};

type SpectatorComment = {
  id: string;
  roomId: string;
  userId: string;
  userDisplayName: string;
  content: string;
  createdAt: Date;
};

type StoreSnapshot = {
  users: User[];
  emailCodes: EmailCodeRecord[];
  campaigns: Campaign[];
  characters: Character[];
  rooms: Room[];
  events: StoryEvent[];
  mediaJobs: MediaJob[];
  shareLinks: ShareLink[];
  spectatorComments: SpectatorComment[];
};

@Injectable()
export class MemoryStoreService implements OnModuleInit {
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
  private readonly snapshotPath = path.resolve(
    process.cwd(),
    '.runtime',
    'file-store.json',
  );

  onModuleInit() {
    this.load();
  }

  saveCode(email: string, code: string) {
    this.emailCodes.set(email, {
      email,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    this.persist();
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
    this.persist();
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
      displayName: email.split('@')[0] ?? email,
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    this.userByEmail.set(email, user);
    this.persist();
    return user;
  }

  getUser(userId: string) {
    return this.users.get(userId);
  }

  createCampaign(
    ownerId: string,
    input: Omit<Campaign, 'id' | 'ownerId' | 'createdAt'>,
  ) {
    const campaign: Campaign = {
      id: randomUUID(),
      ownerId,
      createdAt: new Date(),
      ...input,
    };
    this.campaigns.set(campaign.id, campaign);
    this.persist();
    return campaign;
  }

  listCampaigns(ownerId: string) {
    return [...this.campaigns.values()]
      .filter((campaign) => campaign.ownerId === ownerId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  getCampaign(campaignId: string) {
    return this.campaigns.get(campaignId);
  }

  createCharacter(
    input: Omit<Character, 'portraitAssets'> & {
      portraitAssets?: PortraitAsset[];
    },
  ) {
    const character: Character = {
      ...input,
      portraitAssets: input.portraitAssets ?? [],
    };
    this.characters.set(input.id, character);
    this.persist();
    return character;
  }

  getCharacter(characterId: string) {
    return this.characters.get(characterId);
  }

  addPortrait(
    characterId: string,
    portrait: Omit<
      PortraitAsset,
      'id' | 'createdAt' | 'status' | 'characterId'
    >,
  ) {
    const character = this.characters.get(characterId);
    if (!character) {
      return undefined;
    }

    character.portraitAssets.unshift({
      id: randomUUID(),
      characterId,
      status: 'succeeded',
      createdAt: new Date(),
      ...portrait,
    });
    this.characters.set(characterId, character);
    this.persist();
    return character;
  }

  listCharacters(campaignId: string) {
    return [...this.characters.values()]
      .filter((character) => character.campaignId === campaignId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  createRoom(
    input: Omit<Room, 'id' | 'createdAt' | 'passwordHash'> & {
      password?: string;
    },
  ) {
    const room: Room = {
      id: randomUUID(),
      createdAt: new Date(),
      passwordHash: input.password
        ? this.hashSecret(input.password)
        : undefined,
      ...input,
    };
    delete (room as Room & { password?: string }).password;
    this.rooms.set(room.id, room);
    this.persist();
    return room;
  }

  listRooms(userId: string, campaignId?: string) {
    return [...this.rooms.values()]
      .filter(
        (room) =>
          room.createdBy === userId &&
          (!campaignId || room.campaignId === campaignId),
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  addEvent(event: Omit<StoryEvent, 'id' | 'createdAt'>) {
    const record: StoryEvent = {
      id: randomUUID(),
      createdAt: new Date(),
      ...event,
    };
    const items = this.events.get(event.roomId) ?? [];
    items.push(record);
    this.events.set(event.roomId, items);
    this.persist();
    return record;
  }

  listEvents(roomId: string) {
    return this.events.get(roomId) ?? [];
  }

  addMediaJob(job: Omit<MediaJob, 'id' | 'status' | 'createdAt'>) {
    const record: MediaJob = {
      id: randomUUID(),
      status: 'queued',
      createdAt: new Date(),
      ...job,
    };
    const items = this.mediaJobs.get(job.roomId) ?? [];
    items.push(record);
    this.mediaJobs.set(job.roomId, items);
    this.persist();
    return record;
  }

  listMediaJobs(roomId: string) {
    return this.mediaJobs.get(roomId) ?? [];
  }

  listAllMediaJobs() {
    return [...this.mediaJobs.values()].flat();
  }

  getMediaJob(jobId: string) {
    return [...this.mediaJobs.values()].flat().find((job) => job.id === jobId);
  }

  updateMediaJobStatus(jobId: string, status: string) {
    for (const [roomId, items] of this.mediaJobs.entries()) {
      const index = items.findIndex((item) => item.id === jobId);
      if (index >= 0) {
        items[index] = { ...items[index], status };
        this.mediaJobs.set(roomId, items);
        this.persist();
        return items[index];
      }
    }

    return undefined;
  }

  createShareLink(input: Omit<ShareLink, 'id' | 'createdAt'>) {
    const key = `${input.targetType}:${input.targetId}`;
    const existing = this.shareLinksByTarget.get(key);
    if (existing && !existing.revokedAt) {
      return existing;
    }

    const record: ShareLink = {
      id: randomUUID(),
      createdAt: new Date(),
      ...input,
    };
    this.shareLinks.set(record.token, record);
    this.shareLinksByTarget.set(key, record);
    this.persist();
    return record;
  }

  getShareLink(token: string) {
    return this.shareLinks.get(token);
  }

  addSpectatorComment(
    roomId: string,
    userId: string,
    userDisplayName: string,
    content: string,
  ) {
    const record: SpectatorComment = {
      id: randomUUID(),
      roomId,
      userId,
      userDisplayName,
      content,
      createdAt: new Date(),
    };
    const items = this.spectatorComments.get(roomId) ?? [];
    items.push(record);
    this.spectatorComments.set(roomId, items);
    this.persist();
    return record;
  }

  listSpectatorComments(roomId: string) {
    return this.spectatorComments.get(roomId) ?? [];
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

  private hashSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private load() {
    if (!fs.existsSync(this.snapshotPath)) {
      return;
    }

    const snapshot = JSON.parse(
      fs.readFileSync(this.snapshotPath, 'utf-8'),
    ) as StoreSnapshot;

    snapshot.users.forEach((item) => {
      const user = { ...item, createdAt: new Date(item.createdAt) };
      this.users.set(user.id, user);
      this.userByEmail.set(user.email, user);
    });
    snapshot.emailCodes.forEach((item) =>
      this.emailCodes.set(item.email, item),
    );
    snapshot.campaigns.forEach((item) =>
      this.campaigns.set(item.id, {
        ...item,
        createdAt: new Date(item.createdAt),
      }),
    );
    snapshot.characters.forEach((item) =>
      this.characters.set(item.id, {
        ...item,
        portraitAssets: item.portraitAssets.map((portrait) => ({
          ...portrait,
          createdAt: new Date(portrait.createdAt),
        })),
      }),
    );
    snapshot.rooms.forEach((item) =>
      this.rooms.set(item.id, {
        ...item,
        createdAt: new Date(item.createdAt),
      }),
    );
    snapshot.events.forEach((item) => {
      const records = this.events.get(item.roomId) ?? [];
      records.push({
        ...item,
        createdAt: new Date(item.createdAt),
      });
      this.events.set(item.roomId, records);
    });
    snapshot.mediaJobs.forEach((item) => {
      const records = this.mediaJobs.get(item.roomId) ?? [];
      records.push({
        ...item,
        createdAt: new Date(item.createdAt),
      });
      this.mediaJobs.set(item.roomId, records);
    });
    snapshot.shareLinks.forEach((item) => {
      const shareLink = {
        ...item,
        createdAt: new Date(item.createdAt),
        revokedAt: item.revokedAt ? new Date(item.revokedAt) : undefined,
      };
      this.shareLinks.set(shareLink.token, shareLink);
      this.shareLinksByTarget.set(
        `${shareLink.targetType}:${shareLink.targetId}`,
        shareLink,
      );
    });
    snapshot.spectatorComments.forEach((item) => {
      const records = this.spectatorComments.get(item.roomId) ?? [];
      records.push({
        ...item,
        createdAt: new Date(item.createdAt),
      });
      this.spectatorComments.set(item.roomId, records);
    });
  }

  private persist() {
    fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });
    const snapshot: StoreSnapshot = {
      users: [...this.users.values()],
      emailCodes: [...this.emailCodes.values()],
      campaigns: [...this.campaigns.values()],
      characters: [...this.characters.values()],
      rooms: [...this.rooms.values()],
      events: [...this.events.values()].flat(),
      mediaJobs: [...this.mediaJobs.values()].flat(),
      shareLinks: [...this.shareLinks.values()],
      spectatorComments: [...this.spectatorComments.values()].flat(),
    };
    fs.writeFileSync(
      this.snapshotPath,
      JSON.stringify(snapshot, null, 2),
      'utf-8',
    );
  }
}
