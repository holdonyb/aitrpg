import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { CampaignsController } from "./campaigns/campaigns.controller";
import { CampaignsService } from "./campaigns/campaigns.service";
import { RoomsController } from "./rooms/rooms.controller";
import { RoomsService } from "./rooms/rooms.service";
import { MemoryStoreService } from "./store/memory-store.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController, AuthController, CampaignsController, RoomsController],
  providers: [
    AppService,
    AuthService,
    CampaignsService,
    RoomsService,
    MemoryStoreService,
  ],
})
export class AppModule {}
