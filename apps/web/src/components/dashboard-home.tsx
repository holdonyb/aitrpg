"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiFetch,
  type AuthPayload,
  type Campaign,
  type SystemStatus,
} from "@/lib/api";
import { useAuthToken } from "@/lib/use-auth-token";

export function DashboardHome() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [status, setStatus] = useState("等待登录");
  const [email, setEmail] = useState("dm@example.com");
  const [code, setCode] = useState("");
  const { token, ready, setToken } = useAuthToken();
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
    try {
      const payload = await apiFetch<Campaign[]>("/campaigns", {}, authToken);
      setCampaigns(payload);
      const lastCampaignId = window.localStorage.getItem("aitrpg-campaign-id");
      if (!lastCampaignId && payload[0]) {
        window.localStorage.setItem("aitrpg-campaign-id", payload[0].id);
      }
      setStatus(payload.length ? "已恢复战役列表" : "已登录，尚未创建战役");
    } catch (error) {
      setStatus(`战役恢复失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [token]);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshCampaigns(token);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ready, refreshCampaigns, token]);

  async function requestCode() {
    setStatus("请求验证码中");
    const response = await apiFetch<{ debugCode: string }>(
      "/auth/email/send-code",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
    if (response.debugCode) {
      setCode(response.debugCode);
    }
    setStatus("验证码已发送");
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
    setStatus("已退出");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
            AITRPG
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none text-[var(--foreground)]">
            开一场冒险，让故事留下来。
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#d6d1c5]">
            创建战役、组织队伍、推进剧情，再把这一夜的故事整理成插画、小说和可分享的记录。
          </p>
        </div>

        <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
            当前概览
          </p>
          <div className="mt-4 space-y-3 text-sm text-[#d8d3c7]">
            <p>产品: {system?.product ?? "加载中"}</p>
            <p>登录方式: {system?.authMode ?? "加载中"}</p>
            <p>体验形态: {system?.roomSurface ?? "加载中"}</p>
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
            我的战役
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
                  还没有战役，先创建一场冒险。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
