"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiFetch, type Campaign, type Character, type Room } from "@/lib/api";
import { useAuthToken } from "@/lib/use-auth-token";

export function CampaignWorkspace({ campaignId }: { campaignId: string }) {
  const { token, ready } = useAuthToken();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [status, setStatus] = useState("加载战役");

  const [characterName, setCharacterName] = useState("Lyra");
  const [characterAncestry, setCharacterAncestry] = useState("Human");
  const [characterClassName, setCharacterClassName] = useState("MAGE");
  const [characterBackground, setCharacterBackground] = useState(
    "A frontier scholar who left the capital to track forbidden fire rites.",
  );
  const [characterPersonality, setCharacterPersonality] = useState(
    "Calm, precise, and stubborn under pressure.",
  );

  const [roomTitle, setRoomTitle] = useState("第一夜营地");
  const [roomDescription, setRoomDescription] = useState(
    "篝火边的第一轮情报交换与试探。",
  );
  const [roomVisibility, setRoomVisibility] = useState<"PRIVATE" | "LINK" | "PUBLIC">("LINK");
  const [roomPassword, setRoomPassword] = useState("stormgate");
  const [spectatorCommentEnabled, setSpectatorCommentEnabled] = useState(true);

  const refreshWorkspace = useCallback(async (authToken = token) => {
    setStatus("同步战役、角色和房间");
    try {
      const campaigns = await apiFetch<Campaign[]>("/campaigns", {}, authToken);
      setCampaign(campaigns.find((item) => item.id === campaignId) ?? null);
      setCharacters(
        await apiFetch<Character[]>(`/campaigns/${campaignId}/characters`, {}, authToken),
      );
      setRooms(await apiFetch<Room[]>(`/rooms?campaignId=${campaignId}`, {}, authToken));
      setStatus("战役工作台已同步");
    } catch (error) {
      setStatus(`战役同步失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [campaignId, token]);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }

    window.localStorage.setItem("aitrpg-campaign-id", campaignId);
    const timer = window.setTimeout(() => {
      void refreshWorkspace(token);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [campaignId, ready, refreshWorkspace, token]);

  async function createCharacter() {
    setStatus("创建角色中");
    await apiFetch(
      `/campaigns/${campaignId}/characters`,
      {
        method: "POST",
        body: JSON.stringify({
          name: characterName,
          ancestry: characterAncestry,
          className: characterClassName,
          background: characterBackground,
          personality: characterPersonality,
          controlledBy: "PLAYER",
        }),
      },
      token,
    );
    await refreshWorkspace();
    setStatus("角色已创建");
  }

  async function generatePortrait(characterId: string) {
    setStatus("生成 portrait 中");
    await apiFetch(
      `/characters/${characterId}/portrait`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: "Fantasy portrait with ember light, travel wear, and strong silhouette.",
        }),
      },
      token,
    );
    await refreshWorkspace();
    setStatus("portrait 已生成");
  }

  async function createRoom() {
    setStatus("创建房间中");
    const room = await apiFetch<Room>(
      "/rooms",
      {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          title: roomTitle,
          description: roomDescription,
          visibility: roomVisibility,
          password: roomPassword || undefined,
          spectatorCommentEnabled,
        }),
      },
      token,
    );
    window.localStorage.setItem("aitrpg-room-id", room.id);
    await refreshWorkspace();
    setStatus("房间已创建");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:px-10">
      <section className="flex items-start justify-between gap-6 border border-[var(--panel-border)] bg-[var(--panel)] p-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent-2)]">
            AITRPG / Campaign Studio
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none">
            {campaign?.title ?? "战役加载中"}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#d6d1c5]">
            {campaign?.pitch ?? "正在加载战役简介。"}
          </p>
        </div>
        <div className="space-y-3 text-right text-sm text-[#d8d3c7]">
          <div>{status}</div>
          <Link className="underline underline-offset-4" href="/">
            返回首页
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
            Character Forge
          </h2>
          <div className="mt-5 space-y-4 text-sm">
            <input
              className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={characterName}
              onChange={(event) => setCharacterName(event.target.value)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={characterAncestry}
                onChange={(event) => setCharacterAncestry(event.target.value)}
              />
              <select
                className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                value={characterClassName}
                onChange={(event) => setCharacterClassName(event.target.value)}
              >
                <option value="WARRIOR">战士</option>
                <option value="RANGER">游侠</option>
                <option value="MAGE">法师</option>
                <option value="CLERIC">牧师</option>
                <option value="ROGUE">游荡者</option>
                <option value="BARD">吟游诗人</option>
              </select>
            </div>
            <textarea
              className="min-h-24 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={characterBackground}
              onChange={(event) => setCharacterBackground(event.target.value)}
            />
            <input
              className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
              value={characterPersonality}
              onChange={(event) => setCharacterPersonality(event.target.value)}
            />
            <button
              className="w-full bg-[var(--accent)] px-4 py-3 text-left text-black"
              onClick={createCharacter}
            >
              创建角色
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-[var(--panel-border)] bg-[var(--panel)] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
                角色列表
              </h2>
              <button
                className="border border-white/15 px-4 py-2 text-sm text-[#d8d3c7]"
                onClick={() => void refreshWorkspace()}
              >
                刷新
              </button>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {characters.length ? (
                characters.map((character) => (
                  <div key={character.id} className="grid gap-3 border border-white/8 bg-black/10 p-4 md:grid-cols-[116px_1fr]">
                    <div className="overflow-hidden border border-white/10 bg-black/20">
                      {character.portrait ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={`${character.name} portrait`}
                          className="h-[144px] w-full object-cover"
                          src={character.portrait.imageUrl}
                        />
                      ) : (
                        <div className="flex h-[144px] items-center justify-center text-xs text-[#c8c1b5]">
                          无 portrait
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-lg text-[#ece5d8]">{character.name}</div>
                      <div className="text-sm text-[#c8c1b5]">
                        {character.ancestry} / {character.className}
                      </div>
                      <button
                        className="border border-[var(--accent-2)] px-4 py-2 text-sm text-[var(--accent-2)]"
                        onClick={() => void generatePortrait(character.id)}
                      >
                        {character.portrait ? "重生成 portrait" : "生成 portrait"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                  还没有角色。
                </div>
              )}
            </div>
          </div>

          <div className="border border-[var(--panel-border)] bg-[rgba(15,18,23,0.88)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
              Live Session Rooms
            </h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-4 text-sm">
                <input
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  value={roomTitle}
                  onChange={(event) => setRoomTitle(event.target.value)}
                />
                <textarea
                  className="min-h-24 w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  value={roomDescription}
                  onChange={(event) => setRoomDescription(event.target.value)}
                />
                <select
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  value={roomVisibility}
                  onChange={(event) =>
                    setRoomVisibility(event.target.value as "PRIVATE" | "LINK" | "PUBLIC")
                  }
                >
                  <option value="PRIVATE">私有</option>
                  <option value="LINK">持链接可见</option>
                  <option value="PUBLIC">公开</option>
                </select>
                <input
                  className="w-full border border-white/10 bg-black/20 px-4 py-3 outline-none"
                  value={roomPassword}
                  onChange={(event) => setRoomPassword(event.target.value)}
                />
                <label className="flex items-center gap-3 text-[#d8d3c7]">
                  <input
                    type="checkbox"
                    checked={spectatorCommentEnabled}
                    onChange={(event) => setSpectatorCommentEnabled(event.target.checked)}
                  />
                  开启观众评论流
                </label>
                <button
                  className="w-full bg-[var(--accent-2)] px-4 py-3 text-left text-black"
                  onClick={createRoom}
                >
                  创建房间
                </button>
              </div>
              <div className="space-y-3">
                {rooms.length ? (
                  rooms.map((room) => (
                    <Link
                      key={room.id}
                      className="block border border-white/8 bg-black/10 px-4 py-4 transition hover:border-[var(--accent)]"
                      href={`/rooms/${room.id}`}
                      onClick={() => window.localStorage.setItem("aitrpg-room-id", room.id)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-lg text-[#ece5d8]">{room.title}</div>
                        <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-2)]">
                          {room.visibility}
                        </div>
                      </div>
                      <div className="mt-2 text-sm leading-7 text-[#c8c1b5]">
                        {room.description}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="border border-white/8 bg-black/10 px-4 py-4 text-sm text-[#c8c1b5]">
                    还没有房间。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
