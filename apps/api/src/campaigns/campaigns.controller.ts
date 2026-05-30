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
  async listCharacters(
    @Headers('authorization') authorization: string | undefined,
    @Param('campaignId') campaignId: string,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.campaignsService.listCharacters(user.id, campaignId);
  }

  @Post(':campaignId/characters')
  async createCharacter(
    @Headers('authorization') authorization: string | undefined,
    @Param('campaignId') campaignId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.campaignsService.createCharacter(user.id, {
      ...body,
      campaignId,
    });
  }
}
