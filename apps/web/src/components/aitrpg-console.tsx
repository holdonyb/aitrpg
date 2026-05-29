"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window === "undefined" ? "http://localhost:4000/api" : "/api");

type SystemStatus = {
  product: string;
  authMode: string;
  roomSurface: string;
  asyncMedia: string[];
};

type Campaign = { id: string; title: string; pitch: string };
type Room = { id: string; title: string; description: string };
type LedgerResponse = { events: Array<{ id: string; type: string; content: string }> };

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

export function AitrpgConsole() {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("aitrpg-token") ?? "";
  });
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [email, setEmail] = useState("dm@example.com");
  const [code, setCode] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("灰烬王座");
  const [campaignPitch, setCampaignPitch] = useState("一支边境冒险队必须阻止古王冠在战乱中复苏。");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [eventText, setEventText] = useState("夜色压进树林，篝火照出每个人不同的表情。");
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState("");
  const [status, setStatus] = useState("等待操作");

  useEffect(() => {
    apiFetch("/system")
      .then(setSystem)
      .catch((error: Error) => setStatus(`系统状态加载失败: ${error.message}`));
  }, []);

  const authenticated = useMemo(() => token.length > 0, [token]);

  async function requestCode() {
    setStatus("请求验证码中");
    const response = await apiFetch("/auth/email/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setCode(response.debugCode);
    setStatus("验证码已生成，开发环境会直接回填");
  }

  async function verifyCode() {
    setStatus("验证登录中");
    const response = await apiFetch("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    setToken(response.token);
    window.localStorage.setItem("aitrpg-token", response.token);
    setStatus(`已登录为 ${response.user.displayName}`);
  }

  async function createCampaign() {
    setStatus("创建战役中");
    const response = await apiFetch(
      "/campaigns",
      {
        method: "POST",
        body: JSON.stringify({
          title: campaignTitle,
          pitch: campaignPitch,
        }),
      },
      token,
    );
    setCampaign(response);
    setStatus("战役已创建");
  }

  async function createRoom() {
    if (!campaign) return;
    setStatus("创建房间中");
    const response = await apiFetch(
      "/rooms",
      {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaign.id,
          title: "第一夜营地",
          description: "篝火边的第一轮情报交换与试探。",
        }),
      },
      token,
    );
    setRoom(response);
    setStatus("房间已创建");
  }

  async function postEvent() {
    if (!room) return;
    setStatus("写入剧情事件中");
    await apiFetch(
      `/rooms/${room.id}/events`,
      {
        method: "POST",
        body: JSON.stringify({
          roomId: room.id,
          type: "narration",
          content: eventText,
        }),
      },
      token,
    );
    setStatus("剧情事件已写入");
  }

  async function refreshLedger() {
    if (!room) return;
    setStatus("刷新 Story Ledger");
    const response = await apiFetch(`/rooms/${room.id}/ledger`, {}, token);
    setLedger(response);
    setStatus("Story Ledger 已刷新");
  }

  async function fetchSuggestions() {
    if (!room) return;
    setStatus("请求 Co-DM 建议");
    const response = await apiFetch(
      `/rooms/${room.id}/dm-suggestions`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      token,
    );
    setSuggestions(response.suggestions);
    setStatus("Co-DM 建议已返回");
  }

  async function triggerAfterplay(type: "illustration" | "novel" | "video") {
    if (!room) return;
    setStatus(`提交 ${type} 任务`);
    const response = await apiFetch(
      `/rooms/${room.id}/afterplay/${type}`,
      {
        method: "POST",
        body: JSON.stringify({
          title: `自动${type}任务`,
          prompt: `请基于房间 ${room.title} 的剧情记录生成 ${type} 产物。`,
        }),
      },
      token,
    );
    setJobStatus(`${response.type} / ${response.status}`);
    setStatus(`${type} 任务已进入队列`);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_0.9fr]">
      <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
          登录与建团
        </h2>
        <div className="mt-5 space-y-4 text-sm">
          <label className="block">
            <span className="mb-2 block text-[#d8d3c7]">邮箱</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-black"
              onClick={requestCode}
            >
              发送验证码
            </button>
            <button
              className="rounded-full border border-[var(--accent-2)] px-4 py-2 text-[var(--accent-2)]"
              onClick={verifyCode}
            >
              验证登录
            </button>
          </div>
          <label className="block">
            <span className="mb-2 block text-[#d8d3c7]">验证码</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <hr className="border-white/8" />
          <label className="block">
            <span className="mb-2 block text-[#d8d3c7]">战役标题</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={campaignTitle}
              onChange={(event) => setCampaignTitle(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[#d8d3c7]">战役简介</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={campaignPitch}
              onChange={(event) => setCampaignPitch(event.target.value)}
            />
          </label>
          <button
            className="rounded-full bg-[var(--accent-2)] px-4 py-2 text-black disabled:opacity-40"
            disabled={!authenticated}
            onClick={createCampaign}
          >
            创建战役
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
          Live Session Room
        </h2>
        <div className="mt-5 space-y-4 text-sm">
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <p>系统状态: {system ? `${system.product} / ${system.authMode}` : "加载中"}</p>
            <p className="mt-2">战役: {campaign?.title ?? "未创建"}</p>
            <p className="mt-2">房间: {room?.title ?? "未创建"}</p>
            <p className="mt-2">队列任务: {jobStatus || "暂无"}</p>
          </div>
          <button
            className="rounded-full border border-[var(--accent)] px-4 py-2 text-[var(--accent)] disabled:opacity-40"
            disabled={!campaign}
            onClick={createRoom}
          >
            创建房间
          </button>
          <label className="block">
            <span className="mb-2 block text-[#d8d3c7]">叙事事件</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={eventText}
              onChange={(event) => setEventText(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-black disabled:opacity-40"
              disabled={!room}
              onClick={postEvent}
            >
              写入事件
            </button>
            <button
              className="rounded-full border border-[var(--accent-2)] px-4 py-2 text-[var(--accent-2)] disabled:opacity-40"
              disabled={!room}
              onClick={refreshLedger}
            >
              刷新 Ledger
            </button>
            <button
              className="rounded-full border border-[#f1d7a8] px-4 py-2 text-[#f1d7a8] disabled:opacity-40"
              disabled={!room}
              onClick={fetchSuggestions}
            >
              获取 Co-DM 建议
            </button>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-[var(--accent-2)]">
              Story Ledger
            </p>
            <div className="space-y-3">
              {ledger?.events?.length ? (
                ledger.events.map((event) => (
                  <div key={event.id} className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                      {event.type}
                    </div>
                    <div className="mt-2 leading-7 text-[#ece5d8]">{event.content}</div>
                  </div>
                ))
              ) : (
                <div className="text-[#c8c1b5]">还没有加载到事件。</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
          Afterplay Studio
        </h2>
        <div className="mt-5 space-y-4 text-sm">
          <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <p>当前状态</p>
            <p className="mt-2 text-[#d8d1c4]">{status}</p>
          </div>
          <div className="space-y-3">
            <button
              className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-left text-black disabled:opacity-40"
              disabled={!room}
              onClick={() => triggerAfterplay("illustration")}
            >
              生成结团插画任务
            </button>
            <button
              className="w-full rounded-2xl bg-[var(--accent-2)] px-4 py-3 text-left text-black disabled:opacity-40"
              disabled={!room}
              onClick={() => triggerAfterplay("novel")}
            >
              生成奇幻小说任务
            </button>
            <button
              className="w-full rounded-2xl bg-[#d8756b] px-4 py-3 text-left text-black disabled:opacity-40"
              disabled={!room}
              onClick={() => triggerAfterplay("video")}
            >
              生成短视频任务
            </button>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-[var(--accent-2)]">
              Co-DM Suggestions
            </p>
            <div className="space-y-3 text-[#ece5d8]">
              {suggestions.length ? (
                suggestions.map((item) => (
                  <div key={item} className="rounded-2xl bg-white/5 px-4 py-3 leading-7">
                    {item}
                  </div>
                ))
              ) : (
                <div className="text-[#c8c1b5]">尚未请求建议。</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
