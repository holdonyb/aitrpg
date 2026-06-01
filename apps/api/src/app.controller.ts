import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';

import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { ReviewRunsService } from './review-runs/review-runs.service';

@Controller('system')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly reviewRunsService: ReviewRunsService,
  ) {}

  @Get()
  getSystemStatus() {
    return this.appService.getSystemStatus();
  }

  @Get('health')
  getHealthStatus() {
    return this.appService.getHealthSnapshot();
  }

  @Get('review-reports')
  async listReviewReports(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.authenticateHeader(authorization);
    return this.appService.listReviewReports();
  }

  @Post('review-reports')
  async createReviewReport(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.appService.createReviewReport(user.id, body);
  }

  @Post('review-reports/:reviewReportId/resolve')
  async resolveReviewReport(
    @Headers('authorization') authorization: string | undefined,
    @Param('reviewReportId') reviewReportId: string,
  ) {
    await this.authService.authenticateHeader(authorization);
    return this.appService.resolveReviewReport(reviewReportId);
  }

  @Get('review-runs')
  async listReviewRuns(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.authenticateHeader(authorization);
    return this.reviewRunsService.listRuns();
  }

  @Post('review-runs')
  async createReviewRun(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.authService.authenticateHeader(authorization);
    return this.reviewRunsService.createRun(user.id, body);
  }

  @Get('invite-codes')
  async listInviteCodes(
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.authService.authenticateHeader(authorization);
    return this.appService.listInviteCodes();
  }

  @Post('invite-codes')
  async createInviteCode(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    await this.authService.authenticateHeader(authorization);
    return this.appService.createInviteCode(body);
  }

  @Post('invite-codes/:inviteCodeId/disable')
  async disableInviteCode(
    @Headers('authorization') authorization: string | undefined,
    @Param('inviteCodeId') inviteCodeId: string,
  ) {
    await this.authService.authenticateHeader(authorization);
    return this.appService.disableInviteCode(inviteCodeId);
  }
}
