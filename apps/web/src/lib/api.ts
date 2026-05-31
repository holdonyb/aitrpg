"use client";

export const API_BASE =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api")
    : "/api";

export type ApiErrorPayload = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
  issues?: Array<{
    path?: string | string[];
    message: string;
    code?: string;
  }>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly payload: ApiErrorPayload = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  token?: string,
  extraHeaders?: Record<string, string>,
) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  Object.entries(extraHeaders ?? {}).forEach(([key, value]) => {
    headers.set(key, value);
  });

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const raw = await response.text();
    let payload: ApiErrorPayload | undefined;

    try {
      payload = JSON.parse(raw) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }

    const message =
      typeof payload?.message === "string"
        ? payload.message
        : Array.isArray(payload?.message)
          ? payload.message.join(" ")
          : raw;

    throw new ApiError(message || "请求失败", payload);
  }

  return (await response.json()) as T;
}

export type SystemStatus = {
  product: string;
  authMode: string;
  roomSurface: string;
  asyncMedia: string[];
};

export type AuthPayload = {
  token: string;
  user: {
    email: string;
    displayName: string;
  };
};

export type Campaign = {
  id: string;
  title: string;
  pitch: string;
};

export type Character = {
  id: string;
  name: string;
  ancestry: string;
  className: string;
  background?: string;
  personality?: string;
  portrait: null | {
    id: string;
    imageUrl: string;
    status: string;
  };
};

export type Room = {
  id: string;
  campaignId?: string;
  title: string;
  description: string;
  status?: string;
  visibility: "PRIVATE" | "LINK" | "PUBLIC";
  spectatorCommentEnabled: boolean;
};

export type LedgerResponse = {
  events: Array<{ id: string; type: string; content: string }>;
  jobs: Array<{ id: string; type: string; status: string; title: string }>;
};

export type ShareLinkResponse = { token: string };

export type SharedArtifactPayload = {
  share: {
    token: string;
    targetType: "ARTIFACT";
  };
  artifact: {
    id: string;
    roomId: string;
    type: string;
    title: string;
    prompt: string;
    status: string;
    createdAt: string;
  };
};

export type SystemHealth = {
  product: string;
  generatedAt: string;
  storeMode: string;
  checks: {
    api: string;
    database: string;
    email: string;
    mediaWorker: string;
  };
  totals: {
    users: number;
    campaigns: number;
    rooms: number;
    events: number;
    portraits: number;
    reviewReports: number;
    reviewRuns: number;
  };
  jobs: {
    total: number;
    byStatus: Record<string, number>;
  };
};

export type ReviewReport = {
  id: string;
  createdBy: string;
  scope: string;
  reviewerLabel: string;
  status: "pass" | "fail";
  targetType: "SYSTEM" | "ROOM" | "ARTIFACT";
  targetId?: string;
  resolutionStatus: "OPEN" | "RESOLVED";
  summary: string;
  findings: string;
  resolvedAt?: string;
  createdAt: string;
  reviewRunId?: string | null;
};

export type ReviewRun = {
  id: string;
  createdBy: string;
  scope: string;
  reviewerLabel: string;
  targetType: "SYSTEM" | "ROOM" | "ARTIFACT";
  targetId?: string | null;
  brief: string;
  status: "queued" | "running" | "succeeded" | "failed";
  summary?: string | null;
  linkedReviewReportId?: string | null;
  targetLabel?: string | null;
  targetRoomId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};
