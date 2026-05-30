import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly authService: AuthService,
    private readonly campaignsService: CampaignsService,
  ) {}

  @Get()
  async listCampaigns(@Headers('authorization') authorization?: string) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.campaignsService.listCampaigns(user.id);
  }

  @Post()
  async createCampaign(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.campaignsService.createCampaign(user.id, body);
  }

  @Get(':campaignId/characters')
  listCharacters(@Param('campaignId') campaignId: string) {
    return this.campaignsService.listCharacters(campaignId);
  }

  @Post(':campaignId/characters')
  createCharacter(
    @Param('campaignId') campaignId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.campaignsService.createCharacter({
      ...body,
      campaignId,
    });
  }
}
