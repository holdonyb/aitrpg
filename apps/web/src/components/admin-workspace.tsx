"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  apiFetch,
  type InviteCode,
  type ReviewReport,
  type ReviewRun,
  type SystemHealth,
} from "@/lib/api";
import { useAuthToken } from "@/lib/use-auth-token";

type AdminWorkspaceProps = {
  initialTargetType?: "SYSTEM" | "ROOM" | "ARTIFACT";
  initialTargetId?: string;
  initialScope?: string;
  initialReviewerLabel?: string;
  initialBrief?: string;
};

export function AdminWorkspace({
  initialTargetType,
  initialTargetId,
  initialScope,
  initialReviewerLabel,
  initialBrief,
}: AdminWorkspaceProps) {
  const { token, ready } = useAuthToken();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [runs, setRuns] = useState<ReviewRun[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [status, setStatus] = useState("加载后台状态");
  const [scope, setScope] = useState(initialScope ?? "browser-regression");
  const [reviewerLabel, setReviewerLabel] = useState(
    initialReviewerLabel ?? "independent-subagent",
  );
  const [reviewStatus, setReviewStatus] = useState<"pass" | "fail">("fail");
  const [targetType, setTargetType] = useState<"SYSTEM" | "ROOM" | "ARTIFACT">(
    initialTargetType ?? "SYSTEM",
  );
  const [targetId, setTargetId] = useState(initialTargetId ?? "");
  const [summary, setSummary] = useState("观战页和后台页已复测，主链可进入下一轮。");
  const [findings, setFindings] = useState(
    "1. 检查首页、战役页、房间页、观战页和产物页。\n2. 记录通过/不通过结论。\n3. 把需要回流的问题写进这里。",
  );
  const [runBrief, setRunBrief] = useState(
    initialBrief ?? "独立检查当前目标页面是否可进入、核心数据是否加载、分享链路是否仍然可用。",
  );
  const [newInviteCode, setNewInviteCode] = useState("");
  const [newInviteUsageLimit, setNewInviteUsageLimit] = useState("1");

  const refreshAdmin = useCallback(async (authToken = token) => {
    setStatus("同步后台健康面板");
    try {
      const [nextHealth, nextReports, nextRuns, nextInviteCodes] = await Promise.all([
        apiFetch<SystemHealth>("/system/health"),
        apiFetch<ReviewReport[]>("/system/review-reports", {}, authToken),
        apiFetch<ReviewRun[]>("/system/review-runs", {}, authToken),
        apiFetch<InviteCode[]>("/system/invite-codes", {}, authToken),
      ]);
      setHealth(nextHealth);
      setReports(nextReports);
      setRuns(nextRuns);
      setInviteCodes(nextInviteCodes);
      setStatus("后台面板已同步");
    } catch (error) {
      setStatus(`后台同步失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [token]);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshAdmin(token);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ready, refreshAdmin, token]);

  useEffect(() => {
    if (!ready || !token || !runs.some((run) => run.status === "queued" || run.status === "running")) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshAdmin(token);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ready, refreshAdmin, runs, token]);

  async function submitReviewReport() {
    setStatus("提交 review report");
    await apiFetch(
      "/system/review-reports",
      {
        method: "POST",
        body: JSON.stringify({
          scope,
          reviewerLabel,
          status: reviewStatus,
          targetType,
          targetId: targetId || undefined,
          summary,
          findings,
        }),
      },
      token,
    );
    await refreshAdmin();
    setStatus("review report 已提交");
  }

  async function resolveReviewReport(reviewReportId: string) {
    setStatus("标记审查报告为已修复");
    await apiFetch(
      `/system/review-reports/${reviewReportId}/resolve`,
      { method: "POST", body: JSON.stringify({}) },
      token,
    );
    await refreshAdmin();
    setStatus("审查报告已标记为已修复");
  }

  async function createReviewRun() {
    setStatus("触发独立审查任务");
    const createdRun = await apiFetch<ReviewRun>(
      "/system/review-runs",
      {
        method: "POST",
        body: JSON.stringify({
          scope,
          reviewerLabel,
          targetType,
          targetId: targetId || undefined,
          brief: runBrief,
        }),
      },
      token,
    );
    await refreshAdmin();
    setStatus(`独立审查任务已创建: ${createdRun.id}`);
  }

  async function createInviteCode() {
    setStatus("创建邀请码");
    await apiFetch(
      "/system/invite-codes",
      {
        method: "POST",
        body: JSON.stringify({
          code: newInviteCode.trim() || undefined,
          usageLimit: Number(newInviteUsageLimit) || 1,
        }),
      },
      token,
    );
    setNewInviteCode("");
    setNewInviteUsageLimit("1");
    await refreshAdmin();
    setStatus("邀请码已创建");
  }

  async function disableInviteCode(inviteCodeId: string) {
    setStatus("停用邀请码");
    await apiFetch(
      `/system/invite-codes/${inviteCodeId}/disable`,
      { method: "POST", body: JSON.stringify({}) },
      token,
    );
    await refreshAdmin();
    setStatus("邀请码已停用");
  }

  function getTargetHref(run: ReviewRun) {
    if (run.targetType === "ROOM" && run.targetRoomId) {
      return `/rooms/${run.targetRoomId}`;
    }

    if (run.targetType === "ARTIFACT" && run.targetRoomId) {
      return `/rooms/${run.targetRoomId}`;
    }

    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex items-start justify-between gap-6 border border-[var(--panel-border)] bg-[var(--panel)] p-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
            AITRPG / Operator Console
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none">
            后台健康与审查
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#d6d1c5]">
            查看当前运行面状态，记录独立审查结果，并把回归问题沉淀成可追踪条目。
          </p>
        </div>
        <div className="space-y-3 text-right text-sm text-[#d8d3c7]">
          <div>{status}</div>
          <Link className="underline underline-offset-4" href="/">
            返回首页
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
                Health Surface
              </h2>
              <button
                className="border border-white/15 px-4 py-2 text-sm text-[#d8d3c7]"
                onClick={() => void refreshAdmin()}
              >
                刷新
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-[#d8d3c7] md:grid-cols-2">
              <div className="border border-white/8 bg-black/10 px-4 py-3">产品: {health?.product ?? "加载中"}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">存储: {health?.storeMode ?? "加载中"}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">数据库: {health?.checks.database ?? "加载中"}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">邮件: {health?.checks.email ?? "加载中"}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">媒体执行: {health?.checks.mediaWorker ?? "加载中"}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">生成时间: {health?.generatedAt ?? "加载中"}</div>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-[#ece5d8] md:grid-cols-3">
              <div className="border border-white/8 bg-black/10 px-4 py-3">战役: {health?.totals.campaigns ?? 0}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">房间: {health?.totals.rooms ?? 0}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">事件: {health?.totals.events ?? 0}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">角色肖像: {health?.totals.portraits ?? 0}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">邀请码: {health?.totals.inviteCodes ?? 0}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">审查报告: {health?.totals.reviewReports ?? 0}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">审查任务: {health?.totals.reviewRuns ?? 0}</div>
              <div className="border border-white/8 bg-black/10 px-4 py-3">媒体任务: {health?.jobs.total ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              邀请码
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                placeholder="留空则自动生成"
                value={newInviteCode}
                onChange={(event) => setNewInviteCode(event.target.value)}
              />
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                inputMode="numeric"
                value={newInviteUsageLimit}
                onChange={(event) => setNewInviteUsageLimit(event.target.value)}
              />
              <button
                className="w-full bg-[var(--accent)] px-4 py-3 text-left text-black disabled:opacity-40"
                disabled={!token}
                onClick={() => void createInviteCode()}
              >
                创建邀请码
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {inviteCodes.length ? (
                inviteCodes.map((item) => (
                  <div key={item.id} className="border border-white/8 bg-black/10 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-2)]">
                      {item.status} / {item.code}
                    </div>
                    <div className="mt-2 text-sm text-[#d8d3c7]">
                      已使用 {item.usedCount} / {item.usageLimit}
                      {item.expiresAt ? ` / 到期 ${new Date(item.expiresAt).toLocaleString()}` : ""}
                    </div>
                    {item.status === "active" ? (
                      <button
                        className="mt-3 border border-[var(--accent-2)] px-4 py-2 text-sm text-[var(--accent-2)]"
                        onClick={() => void disableInviteCode(item.id)}
                      >
                        停用
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  还没有邀请码。
                </div>
              )}
            </div>
          </div>

          <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Review Run
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <textarea
                className="min-h-24 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={runBrief}
                onChange={(event) => setRunBrief(event.target.value)}
              />
              <button
                className="w-full bg-[var(--accent-2)] px-4 py-3 text-left text-black disabled:opacity-40"
                disabled={!token}
                onClick={() => void createReviewRun()}
              >
                启动独立审查任务
              </button>
            </div>
          </div>

          <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Review Runs
            </h2>
            <div className="mt-5 space-y-3">
              {runs.length ? (
                runs.map((run) => (
                  <div key={run.id} className="border border-white/8 bg-black/10 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-2)]">
                      {run.status} / {run.scope} / {run.reviewerLabel}
                    </div>
                    <div className="mt-2 text-xs text-[#c8c1b5]">
                      目标: {run.targetType}
                      {run.targetId ? ` / ${run.targetId}` : ""}
                    </div>
                    {run.targetLabel ? (
                      <div className="mt-2 text-sm text-[#d8d3c7]">{run.targetLabel}</div>
                    ) : null}
                    <div className="mt-2 text-[#ece5d8]">{run.brief}</div>
                    {run.summary ? (
                      <div className="mt-2 text-sm text-[#c8c1b5]">{run.summary}</div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {run.linkedReviewReportId ? (
                        <a
                          className="text-[var(--accent-2)] underline underline-offset-4"
                          href={`#report-${run.linkedReviewReportId}`}
                        >
                          查看关联报告
                        </a>
                      ) : null}
                      {getTargetHref(run) ? (
                        <Link
                          className="text-[#d8d3c7] underline underline-offset-4"
                          href={getTargetHref(run)!}
                        >
                          打开目标页面
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  还没有独立审查任务。
                </div>
              )}
            </div>
          </div>

          <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Review Report
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              />
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={reviewerLabel}
                onChange={(event) => setReviewerLabel(event.target.value)}
              />
              <select
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value as "pass" | "fail")}
              >
                <option value="fail">不通过</option>
                <option value="pass">通过</option>
              </select>
              <select
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={targetType}
                onChange={(event) =>
                  setTargetType(event.target.value as "SYSTEM" | "ROOM" | "ARTIFACT")
                }
              >
                <option value="SYSTEM">系统级</option>
                <option value="ROOM">房间</option>
                <option value="ARTIFACT">产物</option>
              </select>
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                placeholder="目标 ID，系统级可留空"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              />
              <textarea
                className="min-h-24 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
              <textarea
                className="min-h-40 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={findings}
                onChange={(event) => setFindings(event.target.value)}
              />
              <button
                className="w-full bg-[var(--accent)] px-4 py-3 text-left text-black disabled:opacity-40"
                disabled={!token}
                onClick={() => void submitReviewReport()}
              >
                提交审查报告
              </button>
            </div>
          </div>

          <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Report History
            </h2>
            <div className="mt-5 space-y-3">
              {reports.length ? (
                reports.map((report) => (
                  <div
                    id={`report-${report.id}`}
                    key={report.id}
                    className="border border-white/8 bg-black/10 px-4 py-3"
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-2)]">
                      {report.status} / {report.scope} / {report.reviewerLabel}
                    </div>
                    <div className="mt-2 text-xs text-[#c8c1b5]">
                      目标: {report.targetType}
                      {report.targetId ? ` / ${report.targetId}` : ""} / 回流状态:{" "}
                      {report.resolutionStatus}
                    </div>
                    <div className="mt-2 text-[#ece5d8]">{report.summary}</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#c8c1b5]">
                      {report.findings}
                    </div>
                    {report.reviewRunId ? (
                      <div className="mt-2 text-xs text-[#9f988b]">
                        来自审查任务: {report.reviewRunId}
                      </div>
                    ) : null}
                    {report.resolutionStatus === "OPEN" ? (
                      <button
                        className="mt-3 border border-[var(--accent-2)] px-4 py-2 text-sm text-[var(--accent-2)]"
                        onClick={() => void resolveReviewReport(report.id)}
                      >
                        标记为已修复
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  还没有审查报告。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
