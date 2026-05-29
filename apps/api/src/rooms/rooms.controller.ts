import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";

import { AuthService } from "../auth/auth.service";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
export class RoomsController {
  constructor(
    private readonly authService: AuthService,
    private readonly roomsService: RoomsService,
  ) {}

  @Post()
  createRoom(@Headers("authorization") authorization: string | undefined, @Body() body: unknown) {
    const user = this.authService.authenticateHeader(authorization);
    return this.roomsService.createRoom(user.id, body);
  }

  @Get(":roomId/ledger")
  getLedger(@Headers("authorization") authorization: string | undefined, @Param("roomId") roomId: string) {
    this.authService.authenticateHeader(authorization);
    return this.roomsService.getLedger(roomId);
  }

  @Post(":roomId/events")
  addEvent(@Headers("authorization") authorization: string | undefined, @Param("roomId") roomId: string, @Body() body: Record<string, unknown>) {
    this.authService.authenticateHeader(authorization);
    return this.roomsService.addEvent({
      ...body,
      roomId,
    });
  }

  @Post(":roomId/dm-suggestions")
  getSuggestions(@Headers("authorization") authorization: string | undefined, @Param("roomId") roomId: string) {
    this.authService.authenticateHeader(authorization);
    return this.roomsService.getSuggestions(roomId);
  }

  @Post(":roomId/afterplay/:jobType")
  createAfterplayJob(
    @Headers("authorization") authorization: string | undefined,
    @Param("roomId") roomId: string,
    @Param("jobType") jobType: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.authService.authenticateHeader(authorization);
    return this.roomsService.createMediaJob(roomId, {
      ...body,
      type: jobType,
    });
  }

  @Post(":roomId/share")
  createShareLink(
    @Headers("authorization") authorization: string | undefined,
    @Param("roomId") roomId: string,
    @Body() body: unknown,
  ) {
    const user = this.authService.authenticateHeader(authorization);
    return this.roomsService.createShareLink(user.id, roomId, body);
  }
}
