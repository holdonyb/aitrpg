import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';

type AuthResponse = {
  token: string;
  user: {
    email: string;
    displayName: string;
  };
};

type SendCodeResponse = {
  debugCode: string;
};

type CampaignResponse = {
  id: string;
  title: string;
  pitch: string;
};

type CharacterResponse = {
  id: string;
  name: string;
  portrait: null | {
    id: string;
    imageUrl: string;
    status: string;
  };
};

type RoomResponse = {
  id: string;
  visibility: 'PRIVATE' | 'LINK' | 'PUBLIC';
  spectatorCommentEnabled: boolean;
};

type ShareResponse = {
  token: string;
};

type SharedRoomResponse = {
  room: {
    id: string;
  };
  requiresPassword: boolean;
  accessGranted: boolean;
  events: Array<{ id: string }>;
};

type SharedArtifactResponse = {
  share: {
    token: string;
    targetType: 'ARTIFACT';
  };
  artifact: {
    id: string;
    type: string;
    title: string;
    status: string;
  };
};

type LedgerResponse = {
  events: Array<{ id: string }>;
  jobs: Array<{ id: string; status: string }>;
};

type RoomListResponse = Array<{
  id: string;
  campaignId: string;
}>;

type CommentResponse = {
  content: string;
};

type CommentListResponse = {
  comments: Array<{ id: string }>;
};

type HealthResponse = {
  product: string;
  checks: {
    database: string;
  };
  totals: {
    campaigns: number;
    reviewReports: number;
    reviewRuns?: number;
  };
};

type ReviewReportResponse = {
  id: string;
  scope: string;
  reviewerLabel: string;
  status: 'pass' | 'fail';
  targetType: 'SYSTEM' | 'ROOM' | 'ARTIFACT';
  targetId?: string;
  resolutionStatus: 'OPEN' | 'RESOLVED';
  summary: string;
  findings: string;
};

type ReviewRunResponse = {
  id: string;
  scope: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  targetType: 'SYSTEM' | 'ROOM' | 'ARTIFACT';
  targetId?: string | null;
  summary?: string | null;
  linkedReviewReportId?: string | null;
  targetLabel?: string | null;
  targetRoomId?: string | null;
};

describe('AITRPG API (e2e)', () => {
  let app: INestApplication;
  const snapshotPath = path.resolve(
    process.cwd(),
    '.runtime',
    'file-store.json',
  );

  function resetDatabase() {
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath);
    }
  }

  async function bootstrapApp() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nextApp = moduleFixture.createNestApplication();
    configureApp(nextApp);
    await nextApp.init();
    return nextApp;
  }

  function api() {
    return request(app.getHttpServer() as App);
  }

  beforeEach(async () => {
    process.env.DATA_STORE_MODE = 'file';
    process.env.EMAIL_DELIVERY_MODE = 'debug';
    delete process.env.RESEND_API_KEY;
    resetDatabase();
    app = await bootstrapApp();
  });

  it('returns system metadata', async () => {
    const response = await api().get('/api/system').expect(200);

    expect((response.body as { product: string }).product).toBe('AITRPG');
  });

  it('issues a login code and verifies it', async () => {
    const email = 'dm@example.com';

    const sendResponse = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const sendPayload = sendResponse.body as SendCodeResponse;
    expect(sendPayload.debugCode).toMatch(/^\d{6}$/);

    const verifyResponse = await api()
      .post('/api/auth/email/verify')
      .send({ email, code: sendPayload.debugCode })
      .expect(201);

    const verifyPayload = verifyResponse.body as AuthResponse;
    expect(verifyPayload.token).toEqual(expect.any(String));
    expect(verifyPayload.user.email).toBe(email);
  });

  it('creates a campaign, room, and ledger event after login', async () => {
    const email = 'party@example.com';

    const sendResponse = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const sendPayload = sendResponse.body as SendCodeResponse;
    const verifyResponse = await api()
      .post('/api/auth/email/verify')
      .send({ email, code: sendPayload.debugCode })
      .expect(201);

    const verifyPayload = verifyResponse.body as AuthResponse;
    const token = verifyPayload.token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Ashen Throne',
        pitch:
          'A border party must cross cursed territory before an old crown wakes again.',
      })
      .expect(201);

    const campaignPayload = campaignResponse.body as CampaignResponse;
    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId: campaignPayload.id,
        title: 'First Campfire',
        description:
          'The party tests each other while trading the first clues.',
      })
      .expect(201);

    const roomPayload = roomResponse.body as RoomResponse;
    await api()
      .post(`/api/rooms/${roomPayload.id}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId: roomPayload.id,
        type: 'narration',
        content:
          'Night closes around the camp while each face catches the fire differently.',
      })
      .expect(201);

    const ledgerResponse = await api()
      .get(`/api/rooms/${roomPayload.id}/ledger`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect((ledgerResponse.body as LedgerResponse).events).toHaveLength(1);
  });

  it('returns 400 when room input fails schema validation', async () => {
    const email = 'room-validate@example.com';

    const sendResponse = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const verifyResponse = await api()
      .post('/api/auth/email/verify')
      .send({
        email,
        code: (sendResponse.body as SendCodeResponse).debugCode,
      })
      .expect(201);

    const token = (verifyResponse.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Storm Archive',
        pitch:
          'A scholar party descends into a sealed archive before the floodgates fail.',
      })
      .expect(201);

    const invalidRoomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId: (campaignResponse.body as CampaignResponse).id,
        title: 'Gate',
        description: '太短了',
      })
      .expect(400);

    expect(
      (invalidRoomResponse.body as { message: string }).message,
    ).toBe('Validation failed');
  });

  it('returns system health and persists review reports with resolve flow', async () => {
    const email = 'ops@example.com';

    const sendResponse = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const verifyResponse = await api()
      .post('/api/auth/email/verify')
      .send({
        email,
        code: (sendResponse.body as SendCodeResponse).debugCode,
      })
      .expect(201);

    const token = (verifyResponse.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Operator Watch',
        pitch:
          'A small operator run validates health telemetry and independent review write-back.',
      })
      .expect(201);

    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId: (campaignResponse.body as CampaignResponse).id,
        title: 'Review Bridge',
        description:
          'A short control room scene exists so the review report can attach to a concrete room.',
      })
      .expect(201);

    const roomId = (roomResponse.body as RoomResponse).id;

    const healthResponse = await api().get('/api/system/health').expect(200);
    const healthPayload = healthResponse.body as HealthResponse;

    expect(healthPayload.product).toBe('AITRPG');
    expect(healthPayload.checks.database).toBe('file-store');
    expect(healthPayload.totals.campaigns).toBeGreaterThanOrEqual(1);

    const reviewResponse = await api()
      .post('/api/system/review-reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'operator-regression',
        reviewerLabel: 'independent-subagent',
        status: 'fail',
        targetType: 'ROOM',
        targetId: roomId,
        summary: 'Operator review found one follow-up item.',
        findings:
          'The health panel loads. The next pass should add job retry triggers and richer queue diagnostics.',
      })
      .expect(201);

    const reviewPayload = reviewResponse.body as ReviewReportResponse;
    expect(reviewPayload.scope).toBe('operator-regression');
    expect(reviewPayload.targetType).toBe('ROOM');
    expect(reviewPayload.targetId).toBe(roomId);
    expect(reviewPayload.resolutionStatus).toBe('OPEN');

    const resolvedResponse = await api()
      .post(`/api/system/review-reports/${reviewPayload.id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    expect(
      (resolvedResponse.body as ReviewReportResponse).resolutionStatus,
    ).toBe('RESOLVED');

    const listResponse = await api()
      .get('/api/system/review-reports')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listPayload = listResponse.body as ReviewReportResponse[];
    expect(listPayload).toHaveLength(1);
    expect(listPayload[0]?.id).toBe(reviewPayload.id);
    expect(listPayload[0]?.resolutionStatus).toBe('RESOLVED');
    expect((campaignResponse.body as CampaignResponse).id).toEqual(
      expect.any(String),
    );
  });

  it('creates a room-scoped review run and writes its result back as a review report', async () => {
    const email = 'review-run@example.com';

    const sendResponse = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const verifyResponse = await api()
      .post('/api/auth/email/verify')
      .send({
        email,
        code: (sendResponse.body as SendCodeResponse).debugCode,
      })
      .expect(201);

    const token = (verifyResponse.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Review Run Room',
        pitch:
          'A targeted review run should inspect a concrete room surface and summarize its state.',
      })
      .expect(201);

    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId: (campaignResponse.body as CampaignResponse).id,
        title: 'Review Target Room',
        description:
          'This room exists so the automated review can inspect ledger, share, and afterplay readiness.',
      })
      .expect(201);

    const roomId = (roomResponse.body as RoomResponse).id;

    await api()
      .post(`/api/rooms/${roomId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        type: 'narration',
        content: 'A review lantern is lit so the target room has a real ledger event.',
      })
      .expect(201);

    await api()
      .post(`/api/rooms/${roomId}/share`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'ROOM' })
      .expect(201);

    const runResponse = await api()
      .post('/api/system/review-runs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'automated-browser-pass',
        reviewerLabel: 'independent-subagent',
        targetType: 'ROOM',
        targetId: roomId,
        brief: 'Confirm the target room exposes ledger and share state for operator review.',
      })
      .expect(201);

    const runPayload = runResponse.body as ReviewRunResponse;
    expect(runPayload.scope).toBe('automated-browser-pass');

    await new Promise((resolve) => setTimeout(resolve, 200));

    const runsResponse = await api()
      .get('/api/system/review-runs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const runsPayload = runsResponse.body as ReviewRunResponse[];
    expect(runsPayload[0]?.status).toBe('succeeded');
    expect(runsPayload[0]?.targetType).toBe('ROOM');
    expect(runsPayload[0]?.targetLabel).toBe('Review Target Room');
    expect(runsPayload[0]?.targetRoomId).toBe(roomId);

    const reportsResponse = await api()
      .get('/api/system/review-reports')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const reportsPayload = reportsResponse.body as ReviewReportResponse[];
    expect(reportsPayload[0]?.reviewRunId).toBe(runPayload.id);
    expect(reportsPayload[0]?.targetType).toBe('ROOM');
    expect(reportsPayload[0]?.summary).toContain('room "Review Target Room"');
    expect(reportsPayload[0]?.findings).toContain('Story Ledger 事件数: 1');
    expect(runsPayload[0]?.linkedReviewReportId).toBe(reportsPayload[0]?.id);
  });

  it('creates a shareable room and accepts spectator comments through a share link', async () => {
    const dmEmail = 'dm-share@example.com';
    const viewerEmail = 'viewer@example.com';

    const dmSendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email: dmEmail })
      .expect(201);

    const dmSendPayload = dmSendCode.body as SendCodeResponse;
    const dmVerify = await api()
      .post('/api/auth/email/verify')
      .send({ email: dmEmail, code: dmSendPayload.debugCode })
      .expect(201);

    const dmToken = (dmVerify.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${dmToken}`)
      .send({
        title: 'Black Tide Harbor',
        pitch:
          'The party must find a missing relic warden before the harbor storm breaks.',
      })
      .expect(201);

    const campaignPayload = campaignResponse.body as CampaignResponse;
    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${dmToken}`)
      .send({
        campaignId: campaignPayload.id,
        title: 'Harbor Bell Tower',
        description:
          'One last exchange of leads before the storm swallows the port.',
        visibility: 'LINK',
        password: 'stormgate',
        spectatorCommentEnabled: true,
      })
      .expect(201);

    const roomPayload = roomResponse.body as RoomResponse;
    expect(roomPayload.visibility).toBe('LINK');
    expect(roomPayload.spectatorCommentEnabled).toBe(true);

    await api()
      .post(`/api/rooms/${roomPayload.id}/events`)
      .set('Authorization', `Bearer ${dmToken}`)
      .send({
        roomId: roomPayload.id,
        type: 'narration',
        content:
          'The bell tower sways while the harbor storm reaches the outer docks.',
      })
      .expect(201);

    const shareResponse = await api()
      .post(`/api/rooms/${roomPayload.id}/share`)
      .set('Authorization', `Bearer ${dmToken}`)
      .send({
        targetType: 'ROOM',
      })
      .expect(201);

    const sharePayload = shareResponse.body as ShareResponse;
    expect(sharePayload.token).toEqual(expect.any(String));

    const publicRoomResponse = await api()
      .get(`/api/share/rooms/${sharePayload.token}`)
      .expect(200);

    const sharedRoomPayload = publicRoomResponse.body as SharedRoomResponse;
    expect(sharedRoomPayload.room.id).toBe(roomPayload.id);
    expect(sharedRoomPayload.requiresPassword).toBe(true);
    expect(sharedRoomPayload.accessGranted).toBe(false);
    expect(sharedRoomPayload.events).toHaveLength(0);

    await api()
      .post(`/api/share/rooms/${sharePayload.token}/access`)
      .send({ password: 'wrong-pass' })
      .expect(401);

    const accessResponse = await api()
      .post(`/api/share/rooms/${sharePayload.token}/access`)
      .send({ password: 'stormgate' })
      .expect(201);

    const shareAccessToken = (accessResponse.body as { accessToken: string })
      .accessToken;

    const unlockedRoomResponse = await api()
      .get(`/api/share/rooms/${sharePayload.token}`)
      .set('x-share-access', shareAccessToken)
      .expect(200);

    expect(
      (unlockedRoomResponse.body as SharedRoomResponse).events,
    ).toHaveLength(1);

    const viewerSendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email: viewerEmail })
      .expect(201);

    const viewerSendPayload = viewerSendCode.body as SendCodeResponse;
    const viewerVerify = await api()
      .post('/api/auth/email/verify')
      .send({ email: viewerEmail, code: viewerSendPayload.debugCode })
      .expect(201);

    const viewerToken = (viewerVerify.body as AuthResponse).token;

    const commentResponse = await api()
      .post(`/api/share/rooms/${sharePayload.token}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-share-access', shareAccessToken)
      .send({
        content:
          'The bell tower setup lands well and gives the DM room to pay it off.',
      })
      .expect(201);

    expect((commentResponse.body as CommentResponse).content).toContain(
      'bell tower',
    );

    const commentsResponse = await api()
      .get(`/api/share/rooms/${sharePayload.token}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-share-access', shareAccessToken)
      .expect(200);

    expect(
      (commentsResponse.body as CommentListResponse).comments,
    ).toHaveLength(1);
  });

  it('keeps auth, room, and spectator data after the API restarts', async () => {
    const dmEmail = 'persist-dm@example.com';
    const viewerEmail = 'persist-viewer@example.com';

    const dmSendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email: dmEmail })
      .expect(201);

    const dmVerify = await api()
      .post('/api/auth/email/verify')
      .send({
        email: dmEmail,
        code: (dmSendCode.body as SendCodeResponse).debugCode,
      })
      .expect(201);

    const dmToken = (dmVerify.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${dmToken}`)
      .send({
        title: 'Ember Gorge',
        pitch:
          'The party must escort an ancient scroll out of the canyon before wildfire closes the pass.',
      })
      .expect(201);

    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${dmToken}`)
      .send({
        campaignId: (campaignResponse.body as CampaignResponse).id,
        title: 'Canyon Checkpoint',
        description:
          'The party decides whether to abandon supplies at the wind gate.',
        visibility: 'LINK',
        password: 'embers',
        spectatorCommentEnabled: true,
      })
      .expect(201);

    const campaignId = (campaignResponse.body as CampaignResponse).id;
    const roomId = (roomResponse.body as RoomResponse).id;

    const shareResponse = await api()
      .post(`/api/rooms/${roomId}/share`)
      .set('Authorization', `Bearer ${dmToken}`)
      .send({
        targetType: 'ROOM',
      })
      .expect(201);

    const shareToken = (shareResponse.body as ShareResponse).token;

    const accessResponse = await api()
      .post(`/api/share/rooms/${shareToken}/access`)
      .send({ password: 'embers' })
      .expect(201);

    const shareAccessToken = (accessResponse.body as { accessToken: string })
      .accessToken;

    const viewerSendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email: viewerEmail })
      .expect(201);

    const viewerVerify = await api()
      .post('/api/auth/email/verify')
      .send({
        email: viewerEmail,
        code: (viewerSendCode.body as SendCodeResponse).debugCode,
      })
      .expect(201);

    const viewerToken = (viewerVerify.body as AuthResponse).token;

    await api()
      .post(`/api/share/rooms/${shareToken}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-share-access', shareAccessToken)
      .send({ content: 'The tradeoff here has real pressure.' })
      .expect(201);

    await app.close();
    app = await bootstrapApp();

    await api()
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${dmToken}`)
      .expect(200)
      .expect((response) => {
        const campaigns = response.body as CampaignResponse[];
        expect(campaigns.some((campaign) => campaign.id === campaignId)).toBe(
          true,
        );
      });

    const sharedRoomResponse = await api()
      .get(`/api/share/rooms/${shareToken}`)
      .set('x-share-access', shareAccessToken)
      .expect(200);

    expect((sharedRoomResponse.body as SharedRoomResponse).room.id).toBe(
      roomId,
    );

    const commentsResponse = await api()
      .get(`/api/share/rooms/${shareToken}/comments`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-share-access', shareAccessToken)
      .expect(200);

    expect(
      (commentsResponse.body as CommentListResponse).comments,
    ).toHaveLength(1);
  });

  it('creates a portrait asset and keeps it with afterplay jobs after restart', async () => {
    const email = 'portrait-dm@example.com';

    const sendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const verify = await api()
      .post('/api/auth/email/verify')
      .send({ email, code: (sendCode.body as SendCodeResponse).debugCode })
      .expect(201);

    const token = (verify.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Portrait Run',
        pitch:
          'A tight test campaign that checks the character portrait and afterplay path.',
      })
      .expect(201);

    const campaignId = (campaignResponse.body as CampaignResponse).id;

    const characterResponse = await api()
      .post(`/api/campaigns/${campaignId}/characters`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Lyra',
        ancestry: 'Human',
        className: 'MAGE',
        background: 'A court scholar who now travels with the frontier party.',
        personality: 'Calm, precise, and quietly stubborn.',
        controlledBy: 'PLAYER',
      })
      .expect(201);

    const characterId = (characterResponse.body as CharacterResponse).id;

    const outsiderSendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email: 'portrait-outsider@example.com' })
      .expect(201);
    const outsiderVerify = await api()
      .post('/api/auth/email/verify')
      .send({
        email: 'portrait-outsider@example.com',
        code: (outsiderSendCode.body as SendCodeResponse).debugCode,
      })
      .expect(201);

    await api()
      .post(`/api/characters/${characterId}/portrait`)
      .set(
        'Authorization',
        `Bearer ${(outsiderVerify.body as AuthResponse).token}`,
      )
      .send({
        prompt: 'Unauthorized portrait update attempt.',
      })
      .expect(403);

    const portraitResponse = await api()
      .post(`/api/characters/${characterId}/portrait`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt:
          'Silver-haired mage portrait with ember light and travel-worn robes.',
      })
      .expect(201);

    expect((portraitResponse.body as CharacterResponse).portrait?.status).toBe(
      'succeeded',
    );

    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        title: 'Portrait Check Room',
        description:
          'A short room used to verify portraits and afterplay jobs.',
      })
      .expect(201);

    const roomId = (roomResponse.body as RoomResponse).id;

    await api()
      .post(`/api/rooms/${roomId}/afterplay/illustration`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Portrait Follow-up',
        prompt: 'Render the party after the ruined gate opens.',
      })
      .expect(201);

    await app.close();
    app = await bootstrapApp();

    const charactersResponse = await api()
      .get(`/api/campaigns/${campaignId}/characters`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      (charactersResponse.body as CharacterResponse[])[0]?.portrait,
    ).toBeTruthy();

    const ledgerResponse = await api()
      .get(`/api/rooms/${roomId}/ledger`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect((ledgerResponse.body as LedgerResponse).jobs).toHaveLength(1);
  });

  it('creates a shareable afterplay artifact and keeps it readable after restart', async () => {
    const email = 'artifact-dm@example.com';

    const sendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const verify = await api()
      .post('/api/auth/email/verify')
      .send({ email, code: (sendCode.body as SendCodeResponse).debugCode })
      .expect(201);

    const token = (verify.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Artifact Share',
        pitch: 'A compact campaign used to verify afterplay artifact sharing.',
      })
      .expect(201);

    const campaignId = (campaignResponse.body as CampaignResponse).id;

    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        title: 'Artifact Room',
        description: 'A room that creates one shareable afterplay artifact.',
      })
      .expect(201);

    const roomId = (roomResponse.body as RoomResponse).id;

    const jobResponse = await api()
      .post(`/api/rooms/${roomId}/afterplay/novel`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Recap Chapter',
        prompt: 'Summarize the room as a tight fantasy recap chapter.',
      })
      .expect(201);

    const artifactId = (jobResponse.body as { id: string }).id;

    let attempts = 0;
    let jobs = (
      (
        await api()
          .get(`/api/rooms/${roomId}/ledger`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      ).body as LedgerResponse
    ).jobs;

    while (jobs[0]?.status !== 'succeeded' && attempts < 20) {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      const refresh = await api()
        .get(`/api/rooms/${roomId}/ledger`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      jobs = (refresh.body as LedgerResponse).jobs;
    }

    expect(jobs[0]?.status).toBe('succeeded');

    const shareResponse = await api()
      .post(`/api/artifacts/${artifactId}/share`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'ARTIFACT',
      })
      .expect(201);

    const shareToken = (shareResponse.body as ShareResponse).token;

    const sharedArtifactResponse = await api()
      .get(`/api/share/artifacts/${shareToken}`)
      .expect(200);

    expect(
      (sharedArtifactResponse.body as SharedArtifactResponse).artifact.id,
    ).toBe(artifactId);

    await app.close();
    app = await bootstrapApp();

    const reloadedArtifactResponse = await api()
      .get(`/api/share/artifacts/${shareToken}`)
      .expect(200);

    expect(
      (reloadedArtifactResponse.body as SharedArtifactResponse).artifact.status,
    ).toBe('succeeded');
  });

  it('restores campaigns, characters, rooms, and ledger data after restart through list endpoints', async () => {
    const email = 'restore-dm@example.com';

    const sendCode = await api()
      .post('/api/auth/email/send-code')
      .send({ email })
      .expect(201);

    const verify = await api()
      .post('/api/auth/email/verify')
      .send({ email, code: (sendCode.body as SendCodeResponse).debugCode })
      .expect(201);

    const token = (verify.body as AuthResponse).token;

    const campaignResponse = await api()
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Recovery Drill',
        pitch:
          'A small campaign that verifies the workspace can restore its recent context.',
      })
      .expect(201);

    const campaignId = (campaignResponse.body as CampaignResponse).id;

    await api()
      .post(`/api/campaigns/${campaignId}/characters`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Mira',
        ancestry: 'Elf',
        className: 'RANGER',
        background: 'A marsh guide who knows every ruined causeway by memory.',
        personality: 'Quiet, alert, and difficult to fool.',
        controlledBy: 'PLAYER',
      })
      .expect(201);

    const roomResponse = await api()
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campaignId,
        title: 'Flooded Causeway',
        description:
          'The party decides whether to trust the lights across the marsh.',
      })
      .expect(201);

    const roomId = (roomResponse.body as RoomResponse).id;

    await api()
      .post(`/api/rooms/${roomId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId,
        type: 'narration',
        content:
          'A line of false lights shifts over the reeds and tries to draw the party east.',
      })
      .expect(201);

    await app.close();
    app = await bootstrapApp();

    await api()
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(
          (response.body as CampaignResponse[]).some(
            (item) => item.id === campaignId,
          ),
        ).toBe(true);
      });

    await api()
      .get(`/api/campaigns/${campaignId}/characters`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body as CharacterResponse[]).toHaveLength(1);
      });

    await api()
      .get(`/api/rooms?campaignId=${campaignId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(
          (response.body as RoomListResponse).some(
            (item) => item.id === roomId,
          ),
        ).toBe(true);
      });

    await api()
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect((response.body as RoomResponse).id).toBe(roomId);
      });

    await api()
      .get(`/api/rooms/${roomId}/ledger`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect((response.body as LedgerResponse).events).toHaveLength(1);
      });
  });

  afterEach(async () => {
    await app?.close();
    resetDatabase();
  });
});
