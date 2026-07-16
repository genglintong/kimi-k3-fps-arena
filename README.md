# Gun Arena 🔫

> One prompt → a Kimi K3 agent swarm → a fully playable browser arena shooter. **Zero human-written code.**

[🇨🇳 中文文档](README.zh-CN.md) · [▶️ **Live Demo**](https://oqb4irirfijvw.ok.kimi.link) · [How the swarm built it](#-how-the-k3-swarm-built-this)

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
- 💥 **Game feel** — particles, screen shake, kill feed
- 🔊 **Synthesized WebAudio SFX** — zero audio assets, all sound generated in code
- 📱 **Responsive H5** — plays on mobile too

![Arena](docs/media/arena.jpg)

## 🛠 Tech Stack

React 19 · TypeScript · Canvas 2D game loop · Tailwind CSS · Vite · WebAudio API

The engine lives in [`src/game/`](src/game/): `engine.ts` (loop), `ai.ts` (bot state machines), `world.ts` (map & collision), `audio.ts` (synth), `render.ts` (renderer).

## 🐝 How the K3 Swarm Built This

This is not a one-shot chat demo. It's the output of **Kimi K3's swarm mode** — multiple agents collaborating like a small dev team. The only human input was one sentence:

> 「帮我做一个可实时对战的枪战游戏。」

**1. The orchestrator wrote a plan first.** No code until [`docs/process/plan.md`](docs/process/plan.md) existed: game definition, tech choices, staged milestones, acceptance criteria ("one 3-minute playable match / 4 weapons, 3 items, 5 bots / full menu→fight→results loop").

**2. It recruited sub-agents and split the work.**

| Agent | Mission | Status |
|-------|---------|--------|
| 巴泰 | Scaffold: landing page, shared component lib, sound engine, game constants | ✅ dismissed |
| 泰吉 | Game core `/play`: engine, combat, AI, HUD | ✅ dismissed |
| 鲍蒙 | Results page `/results` | ✅ dismissed |
| 费曼 | Armory + guide pages | ✅ dismissed |

**3. It solved real engineering problems by itself.** The terminal log shows the swarm handling a `package-lock.json` merge conflict, hunting down a stale `git index.lock`, and running three page builds in parallel before the final merge.

![The swarm at work](docs/media/swarm.jpg)

**4. It shipped.** Build passed → version snapshot → deployed preview. One sentence in, a playable game out — no human touched the code.

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
