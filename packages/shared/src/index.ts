import { z } from "zod";

export const roleSchema = z.enum([
  "DM",
  "PLAYER",
  "AGENT",
  "CO_DM",
  "NPC",
  "ENEMY",
]);

export const characterClassSchema = z.enum([
  "WARRIOR",
  "RANGER",
  "MAGE",
  "CLERIC",
  "ROGUE",
  "BARD",
  "CUSTOM",
]);

export const roomStatusSchema = z.enum([
  "DRAFT",
  "READY",
  "LIVE",
  "PAUSED",
  "ENDED",
]);

export const storyEventTypeSchema = z.enum([
  "speech",
  "narration",
  "action",
  "resolution",
  "scene_transition",
  "media_trigger",
]);

export const mediaJobTypeSchema = z.enum([
  "portrait",
  "illustration",
  "novel",
  "video",
]);

export const mediaJobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "retryable",
]);

export const campaignInputSchema = z.object({
  title: z.string().min(2).max(80),
  pitch: z.string().min(10).max(400),
  worldTemplate: z.string().min(2).max(40).default("classic-fantasy"),
  tone: z.string().min(2).max(40).default("adventure"),
});

export const characterInputSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(2).max(40),
  ancestry: z.string().min(2).max(40),
  className: characterClassSchema,
  background: z.string().min(10).max(500),
  personality: z.string().min(2).max(120),
  controlledBy: roleSchema,
});

export const roomInputSchema = z.object({
  campaignId: z.string().uuid(),
  title: z.string().min(2).max(80),
  description: z.string().min(10).max(400),
});

export const roomJoinInputSchema = z.object({
  roomId: z.string().uuid(),
  characterId: z.string().uuid().optional(),
  displayName: z.string().min(2).max(40),
  role: roleSchema,
});

export const storyEventInputSchema = z.object({
  roomId: z.string().uuid(),
  characterId: z.string().uuid().optional(),
  type: storyEventTypeSchema,
  content: z.string().min(1).max(4000),
});

export const mediaJobInputSchema = z.object({
  roomId: z.string().uuid(),
  type: mediaJobTypeSchema,
  title: z.string().min(2).max(80),
  prompt: z.string().min(4).max(4000),
});

export const emailCodeRequestSchema = z.object({
  email: z.email(),
});

export const emailCodeVerifySchema = z.object({
  email: z.email(),
  code: z.string().length(6),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CharacterInput = z.infer<typeof characterInputSchema>;
export type RoomInput = z.infer<typeof roomInputSchema>;
export type RoomJoinInput = z.infer<typeof roomJoinInputSchema>;
export type StoryEventInput = z.infer<typeof storyEventInputSchema>;
export type MediaJobInput = z.infer<typeof mediaJobInputSchema>;
export type EmailCodeRequest = z.infer<typeof emailCodeRequestSchema>;
export type EmailCodeVerify = z.infer<typeof emailCodeVerifySchema>;
