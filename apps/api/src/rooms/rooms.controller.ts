import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly authService: AuthService,
    private readonly roomsService: RoomsService,
  ) {}

  @Post()
  async createRoom(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.createRoom(user.id, body);
  }

  @Get()
  async listRooms(
    @Headers('authorization') authorization: string | undefined,
    @Query('campaignId') campaignId?: string,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.listRooms(user.id, campaignId);
  }

  @Get(':roomId')
  async getRoom(
    @Headers('authorization') authorization: string | undefined,
    @Param('roomId') roomId: string,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.getRoom(user.id, roomId);
  }

  @Get(':roomId/ledger')
  async getLedger(
    @Headers('authorization') authorization: string | undefined,
    @Param('roomId') roomId: string,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.getLedger(user.id, roomId);
  }

  @Post(':roomId/events')
  async addEvent(
    @Headers('authorization') authorization: string | undefined,
    @Param('roomId') roomId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.addEvent(user.id, {
      ...body,
      roomId,
    });
  }

  @Post(':roomId/dm-suggestions')
  async getSuggestions(
    @Headers('authorization') authorization: string | undefined,
    @Param('roomId') roomId: string,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.getSuggestions(user.id, roomId);
  }

  @Post(':roomId/afterplay/:jobType')
  async createAfterplayJob(
    @Headers('authorization') authorization: string | undefined,
    @Param('roomId') roomId: string,
    @Param('jobType') jobType: string,
    @Body() body: Record<string, unknown>,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.createMediaJob(user.id, roomId, {
      ...body,
      type: jobType,
    });
  }

  @Post(':roomId/share')
  async createShareLink(
    @Headers('authorization') authorization: string | undefined,
    @Param('roomId') roomId: string,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.roomsService.createShareLink(user.id, roomId, body);
  }
}
