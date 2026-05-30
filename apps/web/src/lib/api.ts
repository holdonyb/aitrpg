"use client";

export const API_BASE =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api")
    : "/api";

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
    throw new Error(await response.text());
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
