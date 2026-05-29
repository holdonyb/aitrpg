import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";

import { AuthService } from "../auth/auth.service";
import { RoomsService } from "./rooms.service";

@Controller("share")
export class ShareController {
  constructor(
    private readonly authService: AuthService,
    private readonly roomsService: RoomsService,
  ) {}

  @Get("rooms/:token")
  getSharedRoom(@Param("token") token: string) {
    return this.roomsService.getSharedRoom(token);
  }

  @Post("rooms/:token/access")
  accessSharedRoom(@Param("token") token: string, @Body() body: unknown) {
    return this.roomsService.accessSharedRoom(token, body);
  }

  @Get("rooms/:token/comments")
  listSpectatorComments(
    @Headers("authorization") authorization: string | undefined,
    @Param("token") token: string,
  ) {
    this.authService.authenticateHeader(authorization);
    return this.roomsService.listSpectatorComments(token);
  }

  @Post("rooms/:token/comments")
  createSpectatorComment(
    @Headers("authorization") authorization: string | undefined,
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    const user = this.authService.authenticateHeader(authorization);
    return this.roomsService.createSpectatorComment(token, user.id, user.displayName, body);
  }
}
