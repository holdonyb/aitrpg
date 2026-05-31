"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch, type SharedArtifactPayload } from "@/lib/api";

export function SharedArtifactView({ token }: { token: string }) {
  const [payload, setPayload] = useState<SharedArtifactPayload | null>(null);
  const [status, setStatus] = useState("加载会后产物");

  useEffect(() => {
    void apiFetch<SharedArtifactPayload>(`/share/artifacts/${token}`)
      .then((response) => {
        setPayload(response);
        setStatus("会后产物已加载");
      })
      .catch((error: Error) => setStatus(`加载失败: ${error.message}`));
  }, [token]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="border border-[var(--panel-border)] bg-[var(--panel)] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
          AITRPG
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none">
          {payload?.artifact.title ?? "会后产物"}
        </h1>
        <p className="mt-5 text-sm text-[#d8d3c7]">{status}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
            产物信息
          </h2>
          <div className="mt-5 space-y-3 text-sm text-[#d8d3c7]">
            <p>类型: {payload?.artifact.type ?? "加载中"}</p>
            <p>状态: {payload?.artifact.status ?? "加载中"}</p>
            <p>房间: {payload?.artifact.roomId ?? "加载中"}</p>
            <p>分享令牌: {payload?.share.token ?? token}</p>
          </div>
        </div>

        <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
            内容摘要
          </h2>
          <div className="mt-5 border border-white/8 bg-black/10 px-4 py-4 text-sm leading-7 text-[#ece5d8]">
            {payload?.artifact.prompt ?? "正在加载提示内容。"}
          </div>
          <div className="mt-5 text-sm text-[#c8c1b5]">
            这里会展示这次冒险留下来的创作结果与关键信息。
          </div>
          <Link className="mt-5 inline-block underline underline-offset-4" href="/">
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}
