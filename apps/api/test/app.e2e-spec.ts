import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";

describe("ATRPG API (e2e)", () => {
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

    expect(response.body.product).toBe("ATRPG");
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

  afterEach(async () => {
    await app.close();
  });
});
