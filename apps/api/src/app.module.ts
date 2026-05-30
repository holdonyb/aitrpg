import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArtifactsController } from './artifacts/artifacts.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { MailerService } from './auth/mailer.service';
import { CampaignsController } from './campaigns/campaigns.controller';
import { CampaignsService } from './campaigns/campaigns.service';
import { CharactersController } from './characters/characters.controller';
import { MediaJobsService } from './media-jobs/media-jobs.service';
import { PrismaService } from './prisma/prisma.service';
import { RoomsController } from './rooms/rooms.controller';
import { ShareController } from './rooms/share.controller';
import { RoomsService } from './rooms/rooms.service';
import { MemoryStoreService } from './store/memory-store.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    AppController,
    ArtifactsController,
    AuthController,
    CampaignsController,
    CharactersController,
    RoomsController,
    ShareController,
  ],
  providers: [
    AppService,
    AuthService,
    MailerService,
    CampaignsService,
    MediaJobsService,
    MemoryStoreService,
    RoomsService,
    PrismaService,
  ],
})
export class AppModule {}
