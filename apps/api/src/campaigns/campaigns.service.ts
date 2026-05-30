import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  campaignInputSchema,
  characterInputSchema,
  portraitInputSchema,
} from '@aitrpg/shared';

import { PrismaService } from '../prisma/prisma.service';
import { isPrimaryStoreUnavailable } from '../store/fallback';
import { MemoryStoreService } from '../store/memory-store.service';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryStore: MemoryStoreService,
    private readonly configService: ConfigService,
  ) {}

  createCampaign(ownerId: string, body: unknown) {
    const input = campaignInputSchema.parse(body);
    return this.withFallback(
      () =>
        this.prisma.campaign.create({
          data: {
            ownerId,
            ...input,
          },
        }),
      () => this.memoryStore.createCampaign(ownerId, input),
    );
  }

  listCampaigns(ownerId: string) {
    return this.withFallback(
      () =>
        this.prisma.campaign.findMany({
          where: { ownerId },
          orderBy: { createdAt: 'desc' },
        }),
      () => this.memoryStore.listCampaigns(ownerId),
    );
  }

  async createCharacter(userId: string, body: unknown) {
    const input = characterInputSchema.parse(body);
    await this.ensureCampaignOwner(userId, input.campaignId);

    return this.withFallback(
      async () =>
        this.prisma.character
          .create({
            data: {
              id: randomUUID(),
              ...input,
            },
          })
          .then((character) => this.serializeCharacter(character)),
      () =>
        this.serializeCharacter(
          this.memoryStore.createCharacter({
            id: randomUUID(),
            ...input,
          }),
        ),
    );
  }

  async createPortrait(userId: string, characterId: string, body: unknown) {
    const input = portraitInputSchema.parse(body);
    return this.withFallback(
      async () => {
        const character = await this.prisma.character.findUnique({
          where: { id: characterId },
          include: { campaign: true },
        });

        if (!character) {
          throw new NotFoundException('Character not found');
        }

        if (character.campaign.ownerId !== userId) {
          throw new ForbiddenException(
            'Only the campaign DM can update portraits',
          );
        }

        await this.prisma.portraitAsset.create({
          data: {
            characterId,
            prompt:
              input.prompt ??
              `${character.name}, a ${character.ancestry.toLowerCase()} ${character.className.toLowerCase()} in a classic fantasy portrait.`,
            imageUrl: this.buildPortraitDataUrl(character),
          },
        });

        const refreshed = await this.prisma.character.findUnique({
          where: { id: characterId },
          include: {
            portraitAssets: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (!refreshed) {
          throw new NotFoundException('Character not found');
        }

        return this.serializeCharacter(refreshed);
      },
      () => {
        const character = this.memoryStore.getCharacter(characterId);
        if (!character) {
          throw new NotFoundException('Character not found');
        }

        this.assertMemoryCampaignOwner(userId, character.campaignId);

        const refreshed = this.memoryStore.addPortrait(characterId, {
          prompt:
            input.prompt ??
            `${character.name}, a ${character.ancestry.toLowerCase()} ${character.className.toLowerCase()} in a classic fantasy portrait.`,
          imageUrl: this.buildPortraitDataUrl(character),
        });

        if (!refreshed) {
          throw new NotFoundException('Character not found');
        }

        return this.serializeCharacter(refreshed);
      },
    );
  }

  async listCharacters(userId: string, campaignId: string) {
    await this.ensureCampaignOwner(userId, campaignId);

    const characters = await this.withFallback(
      () =>
        this.prisma.character.findMany({
          where: { campaignId },
          include: {
            portraitAssets: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { name: 'asc' },
        }),
      () => this.memoryStore.listCharacters(campaignId),
    );

    return characters.map((character) => this.serializeCharacter(character));
  }

  private async ensureCampaignOwner(userId: string, campaignId: string) {
    const campaign = await this.withFallback(
      () =>
        this.prisma.campaign.findUnique({
          where: { id: campaignId },
        }),
      () => this.memoryStore.getCampaign(campaignId),
    );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the campaign DM can access characters',
      );
    }
  }

  private assertMemoryCampaignOwner(userId: string, campaignId: string) {
    const campaign = this.memoryStore.getCampaign(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the campaign DM can access characters',
      );
    }
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
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (isPrimaryStoreUnavailable(error)) {
        return fallback();
      }

      throw error;
    }
  }

  private serializeCharacter(character: {
    id: string;
    campaignId: string;
    name: string;
    ancestry: string;
    className: string;
    background: string;
    personality: string;
    controlledBy: string;
    portraitAssets?: Array<{
      id: string;
      imageUrl: string;
      prompt: string;
      status: string;
      createdAt: Date | string;
    }>;
  }) {
    const portrait = character.portraitAssets?.[0];

    return {
      id: character.id,
      campaignId: character.campaignId,
      name: character.name,
      ancestry: character.ancestry,
      className: character.className,
      background: character.background,
      personality: character.personality,
      controlledBy: character.controlledBy,
      portrait: portrait
        ? {
            id: portrait.id,
            imageUrl: portrait.imageUrl,
            prompt: portrait.prompt,
            status: portrait.status,
            createdAt: portrait.createdAt,
          }
        : null,
    };
  }

  private buildPortraitDataUrl(character: {
    name: string;
    ancestry: string;
    className: string;
  }) {
    const initials = character.name.slice(0, 2).toUpperCase();
    const subtitle = `${character.ancestry} ${character.className}`.slice(
      0,
      28,
    );
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1a202c"/>
            <stop offset="50%" stop-color="#543864"/>
            <stop offset="100%" stop-color="#d4a373"/>
          </linearGradient>
        </defs>
        <rect width="768" height="1024" fill="url(#bg)"/>
        <circle cx="384" cy="332" r="170" fill="rgba(255,255,255,0.12)"/>
        <circle cx="384" cy="310" r="120" fill="rgba(245,235,220,0.9)"/>
        <path d="M244 650c40-110 240-110 280 0v120H244z" fill="rgba(30,25,38,0.72)"/>
        <text x="384" y="840" text-anchor="middle" font-family="Georgia, serif" font-size="96" fill="#f5eadc">${initials}</text>
        <text x="384" y="910" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#f1e7d8">${character.name}</text>
        <text x="384" y="956" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#ead7bf">${subtitle}</text>
      </svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
