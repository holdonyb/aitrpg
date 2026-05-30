"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiFetch,
  type AuthPayload,
  type Campaign,
  type SystemStatus,
} from "@/lib/api";

export function DashboardHome() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [status, setStatus] = useState("等待登录");
  const [email, setEmail] = useState("dm@example.com");
  const [code, setCode] = useState("");
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("aitrpg-token") ?? "";
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignTitle, setCampaignTitle] = useState("灰烬王座");
  const [campaignPitch, setCampaignPitch] = useState(
    "一支边境冒险队必须阻止古王冠在战乱中复苏。",
  );

  const authenticated = useMemo(() => token.length > 0, [token]);

  useEffect(() => {
    void apiFetch<SystemStatus>("/system")
      .then(setSystem)
      .catch((error: Error) => setStatus(`系统状态加载失败: ${error.message}`));
  }, []);

  const refreshCampaigns = useCallback(async (authToken = token) => {
    const payload = await apiFetch<Campaign[]>("/campaigns", {}, authToken);
    setCampaigns(payload);
    const lastCampaignId = window.localStorage.getItem("aitrpg-campaign-id");
    if (!lastCampaignId && payload[0]) {
      window.localStorage.setItem("aitrpg-campaign-id", payload[0].id);
    }
    setStatus(payload.length ? "已恢复战役列表" : "已登录，尚未创建战役");
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    window.localStorage.setItem("aitrpg-token", token);
    const timer = window.setTimeout(() => {
      void refreshCampaigns(token);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshCampaigns, token]);

  async function requestCode() {
    setStatus("请求验证码中");
    const response = await apiFetch<{ debugCode: string }>(
      "/auth/email/send-code",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
    setCode(response.debugCode);
    setStatus("验证码已生成，开发环境会直接回填");
  }

  async function verifyCode() {
    setStatus("验证登录中");
    const response = await apiFetch<AuthPayload>("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    setToken(response.token);
    setStatus(`已登录为 ${response.user.displayName}`);
  }

  async function createCampaign() {
    setStatus("创建战役中");
    const response = await apiFetch<Campaign>(
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
    window.localStorage.setItem("aitrpg-campaign-id", response.id);
    await refreshCampaigns();
    setStatus("战役已创建");
  }

  function logout() {
    setToken("");
    setCampaigns([]);
    window.localStorage.removeItem("aitrpg-token");
    setStatus("已退出");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
            AITRPG / Command Deck
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none text-[var(--foreground)]">
            登录、建团，然后进入正式工作台。
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#d6d1c5]">
            这一版把单页控制台拆成三段：首页负责登录和战役列表，战役页负责角色与房间，
            房间页负责 Story Ledger、Co-DM 和 afterplay。
          </p>
        </div>

        <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
            系统状态
          </p>
          <div className="mt-4 space-y-3 text-sm text-[#d8d3c7]">
            <p>产品: {system?.product ?? "加载中"}</p>
            <p>鉴权: {system?.authMode ?? "加载中"}</p>
            <p>房间面: {system?.roomSurface ?? "加载中"}</p>
            <p>当前状态: {status}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
            登录
          </h2>
          <div className="mt-5 space-y-4 text-sm">
            <label className="block">
              <span className="mb-2 block text-[#d8d3c7]">邮箱</span>
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <div className="flex gap-3">
              <button
                className="bg-[var(--accent)] px-4 py-3 text-black"
                onClick={requestCode}
              >
                发送验证码
              </button>
              <button
                className="border border-[var(--accent-2)] px-4 py-3 text-[var(--accent-2)]"
                onClick={verifyCode}
              >
                验证登录
              </button>
              <button
                className="border border-white/15 px-4 py-3 text-[#d8d3c7] disabled:opacity-40"
                disabled={!authenticated}
                onClick={logout}
              >
                退出
              </button>
            </div>
            <label className="block">
              <span className="mb-2 block text-[#d8d3c7]">验证码</span>
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
            战役工作台
          </h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4 text-sm">
              <label className="block">
                <span className="mb-2 block text-[#d8d3c7]">战役标题</span>
                <input
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  value={campaignTitle}
                  onChange={(event) => setCampaignTitle(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[#d8d3c7]">战役简介</span>
                <textarea
                  className="min-h-28 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  value={campaignPitch}
                  onChange={(event) => setCampaignPitch(event.target.value)}
                />
              </label>
              <button
                className="w-full bg-[var(--accent-2)] px-4 py-3 text-left text-black disabled:opacity-40"
                disabled={!authenticated}
                onClick={createCampaign}
              >
                创建战役
              </button>
            </div>

            <div className="space-y-3">
              {campaigns.length ? (
                campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    className="block border border-white/8 bg-black/10 px-4 py-4 transition hover:border-[var(--accent)]"
                    href={`/campaigns/${campaign.id}`}
                    onClick={() =>
                      window.localStorage.setItem(
                        "aitrpg-campaign-id",
                        campaign.id,
                      )
                    }
                  >
                    <div className="text-lg text-[#ece5d8]">{campaign.title}</div>
                    <div className="mt-2 text-sm leading-7 text-[#c8c1b5]">
                      {campaign.pitch}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  登录后创建第一个战役。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
