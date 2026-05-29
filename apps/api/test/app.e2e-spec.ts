import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";

describe("AITRPG API (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  it("returns system metadata", async () => {
    const response = await request(app.getHttpServer()).get("/api/system").expect(200);

    expect(response.body.product).toBe("AITRPG");
  });

  it("issues a login code and verifies it", async () => {
    const email = "dm@example.com";

    const sendResponse = await request(app.getHttpServer())
      .post("/api/auth/email/send-code")
      .send({ email })
      .expect(201);

    expect(sendResponse.body.debugCode).toMatch(/^\d{6}$/);

    const verifyResponse = await request(app.getHttpServer())
      .post("/api/auth/email/verify")
      .send({ email, code: sendResponse.body.debugCode })
      .expect(201);

    expect(verifyResponse.body.token).toEqual(expect.any(String));
    expect(verifyResponse.body.user.email).toBe(email);
  });

  it("creates a campaign, room, and ledger event after login", async () => {
    const email = "party@example.com";

    const sendResponse = await request(app.getHttpServer())
      .post("/api/auth/email/send-code")
      .send({ email })
      .expect(201);

    const verifyResponse = await request(app.getHttpServer())
      .post("/api/auth/email/verify")
      .send({ email, code: sendResponse.body.debugCode })
      .expect(201);

    const token = verifyResponse.body.token as string;

    const campaignResponse = await request(app.getHttpServer())
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "灰烬王座",
        pitch: "一支冒险队要穿过被诅咒的边境，阻止失落王冠复苏。",
      })
      .expect(201);

    const roomResponse = await request(app.getHttpServer())
      .post("/api/rooms")
      .set("Authorization", `Bearer ${token}`)
      .send({
        campaignId: campaignResponse.body.id,
        title: "第一夜营地",
        description: "篝火边的第一轮情报交换与试探。",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/rooms/${roomResponse.body.id}/events`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        roomId: roomResponse.body.id,
        type: "narration",
        content: "夜色压进树林，篝火照出每个人不同的表情。",
      })
      .expect(201);

    const ledgerResponse = await request(app.getHttpServer())
      .get(`/api/rooms/${roomResponse.body.id}/ledger`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(ledgerResponse.body.events).toHaveLength(1);
  });

  it("creates a shareable room and accepts spectator comments through a share link", async () => {
    const dmEmail = "dm-share@example.com";
    const viewerEmail = "viewer@example.com";

    const dmSendCode = await request(app.getHttpServer())
      .post("/api/auth/email/send-code")
      .send({ email: dmEmail })
      .expect(201);

    const dmVerify = await request(app.getHttpServer())
      .post("/api/auth/email/verify")
      .send({ email: dmEmail, code: dmSendCode.body.debugCode })
      .expect(201);

    const dmToken = dmVerify.body.token as string;

    const campaignResponse = await request(app.getHttpServer())
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${dmToken}`)
      .send({
        title: "黑潮港",
        pitch: "一支边境队伍要在风暴袭城前找到失踪的圣物守护者。",
      })
      .expect(201);

    const roomResponse = await request(app.getHttpServer())
      .post("/api/rooms")
      .set("Authorization", `Bearer ${dmToken}`)
      .send({
        campaignId: campaignResponse.body.id,
        title: "港口钟楼",
        description: "风暴将至前的最后一次线索交换。",
        visibility: "LINK",
        password: "stormgate",
        spectatorCommentEnabled: true,
      })
      .expect(201);

    expect(roomResponse.body.visibility).toBe("LINK");
    expect(roomResponse.body.spectatorCommentEnabled).toBe(true);

    const shareResponse = await request(app.getHttpServer())
      .post(`/api/rooms/${roomResponse.body.id}/share`)
      .set("Authorization", `Bearer ${dmToken}`)
      .send({
        targetType: "ROOM",
      })
      .expect(201);

    expect(shareResponse.body.token).toEqual(expect.any(String));

    const publicRoomResponse = await request(app.getHttpServer())
      .get(`/api/share/rooms/${shareResponse.body.token}`)
      .expect(200);

    expect(publicRoomResponse.body.room.id).toBe(roomResponse.body.id);
    expect(publicRoomResponse.body.requiresPassword).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/share/rooms/${shareResponse.body.token}/access`)
      .send({ password: "wrong-pass" })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/api/share/rooms/${shareResponse.body.token}/access`)
      .send({ password: "stormgate" })
      .expect(201);

    const viewerSendCode = await request(app.getHttpServer())
      .post("/api/auth/email/send-code")
      .send({ email: viewerEmail })
      .expect(201);

    const viewerVerify = await request(app.getHttpServer())
      .post("/api/auth/email/verify")
      .send({ email: viewerEmail, code: viewerSendCode.body.debugCode })
      .expect(201);

    const viewerToken = viewerVerify.body.token as string;

    const commentResponse = await request(app.getHttpServer())
      .post(`/api/share/rooms/${shareResponse.body.token}/comments`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ content: "这个钟楼伏笔立得很好，等 DM 回收。" })
      .expect(201);

    expect(commentResponse.body.content).toContain("钟楼伏笔");

    const commentsResponse = await request(app.getHttpServer())
      .get(`/api/share/rooms/${shareResponse.body.token}/comments`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(commentsResponse.body.comments).toHaveLength(1);
  });

  afterEach(async () => {
    await app.close();
  });
});
