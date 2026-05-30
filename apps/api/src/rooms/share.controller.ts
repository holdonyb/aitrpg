import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

@Controller('share')
export class ShareController {
  constructor(
    private readonly authService: AuthService,
    private readonly roomsService: RoomsService,
  ) {}

  @Get('rooms/:token')
  getSharedRoom(
    @Param('token') token: string,
    @Headers('x-share-access') shareAccess?: string,
  ) {
    return this.roomsService.getSharedRoom(token, shareAccess);
  }

  @Get('artifacts/:token')
  getSharedArtifact(@Param('token') token: string) {
    return this.roomsService.getSharedArtifact(token);
  }

  @Post('rooms/:token/access')
  accessSharedRoom(@Param('token') token: string, @Body() body: unknown) {
    return this.roomsService.accessSharedRoom(token, body);
  }

  @Get('rooms/:token/comments')
  async listSpectatorComments(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-share-access') shareAccess: string | undefined,
    @Param('token') token: string,
  ) {
    await this.authService.authenticateHeader(authorization);
    return this.roomsService.listSpectatorComments(token, shareAccess);
  }

  @Post('rooms/:token/comments')
  async createSpectatorComment(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-share-access') shareAccess: string | undefined,
    @Param('token') token: string,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.createSpectatorComment(
      token,
      user.id,
      user.displayName,
      shareAccess,
      body,
    );
  }
}
