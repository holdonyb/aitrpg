import { AtrpgConsole } from "@/components/atrpg-console";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-6 py-8 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
            ATRPG / AI 协作跑团
          </p>
          <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-none text-[var(--foreground)] sm:text-6xl">
            人类做 DM，Agent 当冒险队与副 DM。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[#d6d1c5] sm:text-lg">
            这一版先把首条可上线链路打通：邮箱登录、建团、建房、写入剧情记录、获取
            Co-DM 建议，再触发 portrait / illustration / novel / video 的异步任务。
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--panel-border)] bg-[rgba(18,20,26,0.78)] p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">首版边界</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-[#d7d1c8]">
            <li>文本实时房间</li>
            <li>经典西幻队伍职业</li>
            <li>邮箱验证码登录</li>
            <li>结构化 Story Ledger</li>
            <li>会后插画、小说、短视频任务</li>
          </ul>
        </div>
      </section>

      <AtrpgConsole />
    </main>
  );
}
