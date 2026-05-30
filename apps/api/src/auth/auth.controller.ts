import { Body, Controller, Headers, Post } from '@nestjs/common';
import { emailCodeRequestSchema, emailCodeVerifySchema } from '@aitrpg/shared';

import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/send-code')
  sendCode(@Body() body: unknown) {
    const input = emailCodeRequestSchema.parse(body);
    return this.authService.issueCode(input.email);
  }

  @Post('email/verify')
  verifyCode(@Body() body: unknown) {
    const input = emailCodeVerifySchema.parse(body);
    return this.authService.verifyCode(input.email, input.code);
  }

  @Post('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.authenticateHeader(authorization);
  }
}
