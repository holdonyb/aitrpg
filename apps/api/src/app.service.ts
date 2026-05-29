import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getSystemStatus() {
    return {
      product: "ATRPG",
      authMode: "email-code",
      roomSurface: "text-live",
      asyncMedia: ["portrait", "illustration", "novel", "video"],
    };
  }
}

