import assert from "node:assert/strict";
import test from "node:test";

import {
  campaignInputSchema,
  characterInputSchema,
  emailCodeVerifySchema,
  mediaJobInputSchema,
} from "./index";

test("campaignInputSchema accepts a valid campaign", () => {
  const result = campaignInputSchema.parse({
    title: "落日荒原",
    pitch: "一支临时组成的冒险队被卷入古代遗迹和王国阴谋。",
  });

  assert.equal(result.worldTemplate, "classic-fantasy");
});

test("characterInputSchema rejects invalid uuid campaign id", () => {
  assert.throws(() =>
    characterInputSchema.parse({
      campaignId: "bad-id",
      name: "艾琳",
      ancestry: "人类",
      className: "MAGE",
      background: "来自旧都法师塔的见习施法者。",
      personality: "冷静谨慎",
      controlledBy: "PLAYER",
    }),
  );
});

test("mediaJobInputSchema requires a long enough prompt", () => {
  assert.throws(() =>
    mediaJobInputSchema.parse({
      roomId: "198a45a7-5648-45b6-8b52-e4e6fbc8e02f",
      type: "illustration",
      title: "结团插画",
      prompt: "bad",
    }),
  );
});

test("emailCodeVerifySchema requires a six digit code", () => {
  assert.throws(() =>
    emailCodeVerifySchema.parse({
      email: "dm@example.com",
      code: "12345",
    }),
  );
});
