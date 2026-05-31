"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthToken } from "@/lib/use-auth-token";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window === "undefined" ? "http://localhost:4000/api" : "/api");

type SharedRoomPayload = {
  share: {
    token: string;
    targetType: "ROOM";
  };
  room: {
    id: string;
    title: string;
    description: string;
    status: string;
    visibility: "PRIVATE" | "LINK" | "PUBLIC";
    spectatorCommentEnabled: boolean;
  };
  requiresPassword: boolean;
  accessGranted: boolean;
  events: Array<{
    id: string;
    type: string;
    content: string;
    createdAt?: string;
  }>;
};

type CommentPayload = {
  comments: Array<{
    id: string;
    userDisplayName: string;
    content: string;
    createdAt: string;
  }>;
};

async function apiFetch(path: string, init?: RequestInit, token?: string) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export function SharedRoomView({ token }: { token: string }) {
  const [room, setRoom] = useState<SharedRoomPayload | null>(null);
  const [password, setPassword] = useState("stormgate");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<CommentPayload["comments"]>([]);
  const [shareAccessToken, setShareAccessToken] = useState("");
  const [status, setStatus] = useState("加载观战页");
  const { token: authedToken, ready } = useAuthToken();

  useEffect(() => {
    const headers = shareAccessToken
      ? { "x-share-access": shareAccessToken }
      : undefined;

    apiFetch(`/share/rooms/${token}`, { headers })
      .then((payload: SharedRoomPayload) => {
        setRoom(payload);
        setStatus("房间信息已加载");
      })
      .catch((error: Error) => setStatus(`加载失败: ${error.message}`));
  }, [shareAccessToken, token]);

  useEffect(() => {
    if (!ready || !authedToken || !room) {
      return;
    }

    if (room.requiresPassword && !room.accessGranted) {
      return;
    }

    apiFetch(
      `/share/rooms/${token}/comments`,
      {
        headers: shareAccessToken
          ? { "x-share-access": shareAccessToken }
          : undefined,
      },
      authedToken,
    )
      .then((payload: CommentPayload) => setComments(payload.comments))
      .catch(() => undefined);
  }, [authedToken, ready, room, shareAccessToken, token]);

  async function unlockRoom() {
    setStatus("验证观战密码");
    const payload = (await apiFetch(`/share/rooms/${token}/access`, {
      method: "POST",
      body: JSON.stringify({ password }),
    })) as { accessToken: string };
    setShareAccessToken(payload.accessToken);
    setStatus("观战访问已授权");
  }

  async function postComment() {
    if (!authedToken || !comment.trim()) {
      return;
    }

    setStatus("发送观众评论");
    await apiFetch(
      `/share/rooms/${token}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content: comment }),
        headers: shareAccessToken
          ? { "x-share-access": shareAccessToken }
          : undefined,
      },
      authedToken,
    );

    const payload = (await apiFetch(
      `/share/rooms/${token}/comments`,
      {
        headers: shareAccessToken
          ? { "x-share-access": shareAccessToken }
          : undefined,
      },
      authedToken,
    )) as CommentPayload;
    setComments(payload.comments);
    setComment("");
    setStatus("观众评论已写入");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
            AITRPG / Live Spectator
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none text-[var(--foreground)]">
            {room?.room.title ?? "观战房间"}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#d6d1c5]">
            {room?.room.description ?? "正在同步房间简介。"}
          </p>
          <p className="mt-5 text-sm text-[#d8d3c7]">{status}</p>
        </div>

        <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">观战访问</p>
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-[#d8d3c7]">
              <p>可见性: {room?.room.visibility ?? "加载中"}</p>
              <p className="mt-2">评论流: {room?.room.spectatorCommentEnabled ? "开启" : "关闭"}</p>
              <p className="mt-2">时间线访问: {room?.accessGranted ? "已授权" : "未授权"}</p>
              <p className="mt-2">
                登录状态: {authedToken ? "已检测到本地登录令牌" : "未登录，不能发评论"}
              </p>
            </div>
            {room?.requiresPassword ? (
              <>
                <input
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="w-full bg-[var(--accent)] px-4 py-3 text-left text-black"
                  onClick={unlockRoom}
                >
                  输入密码进入
                </button>
              </>
            ) : null}
            <Link className="block text-[#d8d3c7] underline underline-offset-4" href="/">
              返回主工作台登录或开团
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
            主跑团时间线
          </h2>
          <div className="mt-5 space-y-3 text-sm">
            {room?.events.length ? (
              room.events.map((event) => (
                <div key={event.id} className="border border-white/8 bg-black/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-2)]">
                    {event.type}
                  </div>
                  <div className="mt-2 leading-7 text-[#ece5d8]">{event.content}</div>
                </div>
              ))
            ) : (
              <div className="text-[#c8c1b5]">
                {room?.requiresPassword && !room?.accessGranted
                  ? "需要先通过观战密码验证，主时间线才会显示。"
                  : "主时间线还没有事件。"}
              </div>
            )}
          </div>
        </div>

        <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
            观众评论流
          </h2>
          <div className="mt-5 space-y-4 text-sm">
            <textarea
              className="min-h-28 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="登录后可评论，不会写入主剧情时间线。"
            />
            <button
              className="w-full bg-[var(--accent-2)] px-4 py-3 text-left text-black disabled:opacity-40"
              disabled={
                !authedToken ||
                !room?.room.spectatorCommentEnabled ||
                (room?.requiresPassword && !room?.accessGranted)
              }
              onClick={postComment}
            >
              发送评论
            </button>
            <div className="space-y-3">
              {comments.length ? (
                comments.map((item) => (
                  <div key={item.id} className="border border-white/8 bg-black/10 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-2)]">
                      {item.userDisplayName}
                    </div>
                    <div className="mt-2 leading-7 text-[#ece5d8]">{item.content}</div>
                  </div>
                ))
              ) : (
                <div className="text-[#c8c1b5]">还没有观众评论。</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
