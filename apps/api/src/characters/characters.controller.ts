import { Body, Controller, Headers, Param, Post } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { CampaignsService } from '../campaigns/campaigns.service';

@Controller('characters')
export class CharactersController {
  constructor(
    private readonly authService: AuthService,
    private readonly campaignsService: CampaignsService,
  ) {}

  @Post(':characterId/portrait')
  async createPortrait(
    @Headers('authorization') authorization: string | undefined,
    @Param('characterId') characterId: string,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.campaignsService.createPortrait(user.id, characterId, body);
  }
}
