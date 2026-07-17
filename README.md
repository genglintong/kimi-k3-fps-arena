# Gun Arena 🔫

> One prompt → a Kimi K3 agent swarm → a fully playable browser arena shooter. **Zero human-written code.**

[🇨🇳 中文文档](README.zh-CN.md) · [▶️ **Live Demo**](https://oqb4irirfijvw.ok.kimi.link) · [How the swarm built it](#-how-the-k3-swarm-built-this--the-honest-story)

![Gameplay](docs/media/gameplay.gif)

**A 2D top-down arena shooter: you vs 4 AI bots, right in the browser. No login, no install.**

## ▶️ Play

**Online:** https://oqb4irirfijvw.ok.kimi.link (hosted on Kimi)

**Local:**

```bash
npm install
npm run dev                  # dev mode
# or
npm run build && npm run preview   # production build + preview
```

**Controls:** `WASD` move · mouse aim · left-click shoot · `1-4` switch weapons · `ESC` pause

## ✨ Features

- 🔫 **4 weapons** — pistol / shotgun / rifle / sniper, each with distinct damage, fire rate, magazine and spread
- 🤖 **4 AI bots with personalities** — 铁皮蛋, 暴躁菇, 跑跑姜, 神枪阿亮: state-machine brains (patrol / chase / retreat / loot-grab) on a difficulty curve
- 🗺 **Arena map** — cover walls, stealth bushes, item spawns (health / weapon crates / shield)
- ⏱ **3-minute rounds** — kill scoring, live leaderboard, confetti results screen
- 💥 **Game feel** — particles, screen shake, kill feed; object pools (200 bullets / 400 particles) holding a steady 60fps
- 🔊 **Synthesized WebAudio SFX** — zero audio assets, all sound generated in code
- 📱 **Responsive H5** — plays on mobile (with a keyboard-guidance layer)

![Arena](docs/media/arena.jpg)

## 🛠 Tech Stack

React 19 · TypeScript · Canvas 2D game loop · Tailwind CSS · Vite · WebAudio API

The engine lives in [`src/game/`](src/game/): `engine.ts` (loop), `ai.ts` (bot state machines), `world.ts` (map & collision), `audio.ts` (synth), `render.ts` (renderer).

## 🐝 How the K3 Swarm Built This — the honest story

Not a one-shot chat demo: a small AI dev team, with wins **and** fails. The only human input was one sentence:

> 「帮我做一个可实时对战的枪战游戏。」

### 1️⃣ Product decisions before code

The orchestrator didn't just start typing. It laid out the possible routes — real-time PvP needs a WebSocket server; pure-frontend AI bots mean instant play — then picked "fastest to play, most fun": **2D top-down arena vs AI bots** (Brawl-Stars-style movement + aim + cover + items). Then it wrote [`docs/process/plan.md`](docs/process/plan.md) with acceptance criteria ("one 3-minute playable match / 4 weapons, 3 items, 5 bots / full menu→fight→results loop").

![Route decisions and plan.md](docs/media/story-plan.jpg)

### 2️⃣ Recruited 4 sub-agents, split the work

| Agent | Mission | Status |
|-------|---------|--------|
| 巴泰 | Scaffold: landing page, shared component lib, sound engine, game constants | ✅ dismissed |
| 泰吉 | Game core `/play`: engine, combat, AI, HUD | ✅ dismissed |
| 鲍蒙 | Results page `/results` | ✅ dismissed |
| 费曼 | Armory + guide pages | ✅ dismissed |

### 3️⃣ 💥 It hit real engineering problems — and fixed them itself

The terminal log shows the swarm untangling a `package-lock.json` merge conflict (revert → re-merge), hunting down a stale `git index.lock`, then running three page builds in parallel before the final merge.

![Swarm division of labor and git troubleshooting](docs/media/swarm.jpg)

### 4️⃣ Verified like a real team

`tsc` clean, **33 headless AI-behavior tests**, object-pooled bullets/particles for a steady 60fps, plus a mobile guidance layer. All self-imposed, all in the transcript.

### 5️⃣ 💥 V1 shipped… and the preview was dead on arrival

The first version snapshot (`58a8b59`) turned out to be an **empty commit** — a platform-side transient during snapshotting (the same sandbox had its worktree metadata wiped by concurrent ops that week). The user came back with "预览失败,不能发布,修复后发布".

![V1 delivered, preview failed](docs/media/story-fail.jpg)

### 6️⃣ 🔧 Three-layer self-diagnosis → V2 live

The swarm re-verified everything instead of guessing: fresh clone → `npm ci` → `npm run build` (zero errors), static assets all 200, then a real-browser runtime check (actual match played on `/play`). Code cleared; platform snapshot re-created on a `fix-preview` branch → **V2 `1ade6ae`** — the version live today.

![Diagnosis and V2 fix](docs/media/story-fix.jpg)

### 📊 Scorecard

- ✅ Autonomous product decisions & planning · 4-agent parallel build · self-healing git surgery · real verification habits · honest failure analysis
- 💥 Empty V1 snapshot (platform-side, fixed in V2) · "real-time PvP" scoped down to AI bots (no server budget) — a sane call, but worth noting

## 📂 Structure

```
src/
├── game/          # engine: loop / AI / render / audio / input
├── pages/         # Home, Play, Results, Armory, Guide
└── components/    # HUD, results, content components
docs/process/      # the swarm's own artifacts (plan.md, info.md)
```

## 🎁 Try Kimi K3 Yourself

通过我的邀请链接注册 Kimi，双方 100% 拿奖，最高可得 1 年会员等值权益 👉 [点击助力](https://kimi-bot.com/activities/zh-cn/viral-referral/share?scenario=invite&from=share_poster&invitation_code=YZYK4)

<a href="https://kimi-bot.com/activities/zh-cn/viral-referral/share?scenario=invite&from=share_poster&invitation_code=YZYK4">
  <img src="docs/referral.png" alt="Kimi referral" width="280">
</a>

---

Also built by the same swarm: [kimi-k3-worldcup-2026](https://github.com/genglintong/kimi-k3-worldcup-2026) — an animated 2026 World Cup milestones site.

Built with [Kimi K3](https://www.kimi.com) swarm mode. If AI-built games impress you, drop a ⭐.
