import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomInt } from "crypto";
import jwt from "jsonwebtoken";

import { MemoryStoreService } from "../store/memory-store.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly store: MemoryStoreService,
  ) {}

  issueCode(email: string) {
    const code = `${randomInt(100000, 999999)}`;
    this.store.saveCode(email, code);
    return {
      ok: true,
      debugCode: code,
    };
  }

  verifyCode(email: string, code: string) {
    const isValid = this.store.verifyCode(email, code);
    if (!isValid) {
      throw new UnauthorizedException("Invalid verification code");
    }

    const user = this.store.findOrCreateUser(email);
    const secret = this.configService.get<string>("JWT_SECRET") || "atrpg-dev-secret";
    const token = jwt.sign({ sub: user.id, email: user.email }, secret, {
      expiresIn: "7d",
    });

    return {
      token,
      user,
    };
  }

  authenticateHeader(header?: string) {
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.slice("Bearer ".length);
    const secret = this.configService.get<string>("JWT_SECRET") || "atrpg-dev-secret";
    const payload = jwt.verify(token, secret) as { sub: string };
    const user = this.store.getUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException("Unknown user");
    }

    return user;
  }
}

