import { Body, Controller, Headers, Param, Post } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { RoomsService } from '../rooms/rooms.service';

@Controller('artifacts')
export class ArtifactsController {
  constructor(
    private readonly authService: AuthService,
    private readonly roomsService: RoomsService,
  ) {}

  @Post(':artifactId/share')
  async createShareLink(
    @Headers('authorization') authorization: string | undefined,
    @Param('artifactId') artifactId: string,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.createArtifactShareLink(user.id, artifactId, body);
  }
}
