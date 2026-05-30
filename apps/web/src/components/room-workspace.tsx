"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  apiFetch,
  type LedgerResponse,
  type Room,
  type ShareLinkResponse,
} from "@/lib/api";

export function RoomWorkspace({ roomId }: { roomId: string }) {
  const [token] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("aitrpg-token") ?? "";
  });
  const [room, setRoom] = useState<Room | null>(null);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [status, setStatus] = useState("加载房间");
  const [eventText, setEventText] = useState(
    "夜色压进树林，篝火照出每个人不同的表情。",
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [shareLink, setShareLink] = useState("");
  const [artifactLinks, setArtifactLinks] = useState<Record<string, string>>({});

  const refreshRoom = useCallback(async (authToken = token) => {
    setStatus("同步房间与 Story Ledger");
    setRoom(await apiFetch<Room>(`/rooms/${roomId}`, {}, authToken));
    setLedger(await apiFetch<LedgerResponse>(`/rooms/${roomId}/ledger`, {}, authToken));
    setStatus("房间已同步");
  }, [roomId, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    window.localStorage.setItem("aitrpg-room-id", roomId);
    const timer = window.setTimeout(() => {
      void refreshRoom(token);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshRoom, roomId, token]);

  async function postEvent() {
    setStatus("写入剧情事件中");
    await apiFetch(
      `/rooms/${roomId}/events`,
      {
        method: "POST",
        body: JSON.stringify({
          roomId,
          type: "narration",
          content: eventText,
        }),
      },
      token,
    );
    await refreshRoom();
    setStatus("剧情事件已写入");
  }

  async function fetchSuggestions() {
    setStatus("请求 Co-DM 建议");
    const response = await apiFetch<{ suggestions: string[] }>(
      `/rooms/${roomId}/dm-suggestions`,
      { method: "POST", body: JSON.stringify({}) },
      token,
    );
    setSuggestions(response.suggestions);
    setStatus("Co-DM 建议已返回");
  }

  async function triggerAfterplay(type: "illustration" | "novel" | "video") {
    setStatus(`提交 ${type} 任务`);
    await apiFetch(
      `/rooms/${roomId}/afterplay/${type}`,
      {
        method: "POST",
        body: JSON.stringify({
          title: `自动${type}任务`,
          prompt: `请基于房间 ${room?.title ?? roomId} 的剧情记录生成 ${type} 产物。`,
        }),
      },
      token,
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    await refreshRoom();
    setStatus(`${type} 任务已入列`);
  }

  async function createShareLink() {
    setStatus("生成观战链接中");
    const response = await apiFetch<ShareLinkResponse>(
      `/rooms/${roomId}/share`,
      {
        method: "POST",
        body: JSON.stringify({ targetType: "ROOM" }),
      },
      token,
    );
    setShareLink(`${window.location.origin}/share/rooms/${response.token}`);
    setStatus("观战链接已生成");
  }

  async function createArtifactShareLink(artifactId: string) {
    setStatus("生成产物分享链接中");
    const response = await apiFetch<ShareLinkResponse>(
      `/artifacts/${artifactId}/share`,
      {
        method: "POST",
        body: JSON.stringify({ targetType: "ARTIFACT" }),
      },
      token,
    );
    setArtifactLinks((current) => ({
      ...current,
      [artifactId]: `${window.location.origin}/share/artifacts/${response.token}`,
    }));
    setStatus("产物分享链接已生成");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex items-start justify-between gap-6 border border-[var(--panel-border)] bg-[var(--panel)] p-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
            AITRPG / Live Session Room
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none">
            {room?.title ?? "房间加载中"}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#d6d1c5]">
            {room?.description ?? "正在加载房间简介。"}
          </p>
        </div>
        <div className="space-y-3 text-right text-sm text-[#d8d3c7]">
          <div>{status}</div>
          <div>{room?.visibility ?? "未设置"}</div>
          <Link className="underline underline-offset-4" href="/">
            返回首页
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <div className="space-y-6">
          <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Story Ledger
            </h2>
            <div className="mt-5 space-y-3">
              {ledger?.events.length ? (
                ledger.events.map((event) => (
                  <div key={event.id} className="border border-white/8 bg-black/10 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-2)]">
                      {event.type}
                    </div>
                    <div className="mt-2 leading-7 text-[#ece5d8]">{event.content}</div>
                  </div>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  还没有剧情事件。
                </div>
              )}
            </div>
          </div>

          <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Afterplay Studio
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                className="bg-[var(--accent)] px-4 py-3 text-left text-black"
                onClick={() => void triggerAfterplay("illustration")}
              >
                结团插画
              </button>
              <button
                className="bg-[var(--accent-2)] px-4 py-3 text-left text-black"
                onClick={() => void triggerAfterplay("novel")}
              >
                奇幻小说
              </button>
              <button
                className="bg-[var(--danger)] px-4 py-3 text-left text-black"
                onClick={() => void triggerAfterplay("video")}
              >
                短视频
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {ledger?.jobs.length ? (
                ledger.jobs.map((job) => (
                  <div key={job.id} className="border border-white/8 bg-black/10 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                      {job.type} / {job.status}
                    </div>
                    <div className="mt-2 text-[#ece5d8]">{job.title}</div>
                    {job.status === "succeeded" ? (
                      <div className="mt-3 space-y-3">
                        <button
                          className="border border-[var(--accent-2)] px-4 py-2 text-sm text-[var(--accent-2)]"
                          onClick={() => void createArtifactShareLink(job.id)}
                        >
                          分享产物
                        </button>
                        {artifactLinks[job.id] ? (
                          <a
                            className="block break-all text-sm text-[#d8d3c7] underline underline-offset-4"
                            href={artifactLinks[job.id]}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {artifactLinks[job.id]}
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  还没有 afterplay 任务。
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              DM 输入区
            </h2>
            <div className="mt-5 space-y-4">
              <textarea
                className="min-h-32 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={eventText}
                onChange={(event) => setEventText(event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  className="bg-[var(--accent)] px-4 py-3 text-black"
                  onClick={() => void postEvent()}
                >
                  写入事件
                </button>
                <button
                  className="border border-[var(--accent-2)] px-4 py-3 text-[var(--accent-2)]"
                  onClick={() => void fetchSuggestions()}
                >
                  获取 Co-DM 建议
                </button>
                <button
                  className="border border-white/15 px-4 py-3 text-[#d8d3c7]"
                  onClick={() => void refreshRoom()}
                >
                  刷新房间
                </button>
              </div>
            </div>
          </div>

          <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
                观战分享
              </h2>
              <button
                className="border border-[var(--accent-2)] px-4 py-2 text-sm text-[var(--accent-2)]"
                onClick={() => void createShareLink()}
              >
                生成链接
              </button>
            </div>
            {shareLink ? (
              <a
                className="mt-5 block break-all border border-white/8 bg-black/10 px-4 py-3 text-sm text-[#d8d3c7] underline underline-offset-4"
                href={shareLink}
                rel="noreferrer"
                target="_blank"
              >
                {shareLink}
              </a>
            ) : (
              <div className="mt-5 border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                还没有生成观战链接。
              </div>
            )}
          </div>

          <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Co-DM Suggestions
            </h2>
            <div className="mt-5 space-y-3">
              {suggestions.length ? (
                suggestions.map((item) => (
                  <div key={item} className="border border-white/8 bg-black/10 px-4 py-3 leading-7 text-[#ece5d8]">
                    {item}
                  </div>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  尚未请求建议。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
