import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { campaignInputSchema, characterInputSchema } from "@atrpg/shared";

import { MemoryStoreService } from "../store/memory-store.service";

@Injectable()
export class CampaignsService {
  constructor(private readonly store: MemoryStoreService) {}

  createCampaign(ownerId: string, body: unknown) {
    const input = campaignInputSchema.parse(body);
    return this.store.createCampaign(ownerId, input);
  }

  listCampaigns(ownerId: string) {
    return this.store.listCampaigns(ownerId);
  }

  createCharacter(body: unknown) {
    const input = characterInputSchema.parse(body);
    return this.store.createCharacter({
      id: randomUUID(),
      ...input,
    });
  }

  listCharacters(campaignId: string) {
    return this.store.listCharacters(campaignId);
  }
}

