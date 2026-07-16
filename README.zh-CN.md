# 枪火竞技场 Gun Arena 🔫

> 一句话提示词 → Kimi K3 集群（4 个子代理协作）→ 完整可玩的浏览器射击游戏。全程零人工代码。

[🇺🇸 English](README.md) · [▶️ **在线试玩**](https://oqb4irirfijvw.ok.kimi.link) · [它是怎么被 K3 集群造出来的](#-它是怎么被-k3-集群造出来的)

![实战演示](docs/media/gameplay.gif)

**2D 俯视角竞技场枪战 · 玩家 vs 4 个 AI 机器人 · 浏览器打开即玩，无需登录**

## ▶️ 快速开始

**在线玩：** https://oqb4irirfijvw.ok.kimi.link （Kimi 托管）

**本地跑：**

```bash
npm install
npm run dev                  # 开发模式
# 或
npm run build && npm run preview   # 生产构建 + 本地预览
```

**操作：** `WASD` 移动 · 鼠标瞄准 · 左键射击 · `1-4` 切换武器 · `ESC` 暂停

## ✨ 游戏特性

- 🔫 **4 种武器**：手枪 / 霰弹枪 / 步枪 / 狙击枪（伤害、射速、弹匣、散射各不相同）
- 🤖 **4 个 AI 机器人同场竞技**：铁皮蛋 / 暴躁菇 / 跑跑姜 / 神枪阿亮 —— 状态机驱动的个性（巡逻 / 追击 / 撤退 / 抢道具）+ 难度梯度
- 🗺 **竞技场地图**：掩体障碍、灌木丛隐身点、道具刷新点（回血包 / 武器箱 / 护盾）
- ⏱ **3 分钟回合制**：击杀计分、实时积分榜、结算撒花
- 💥 **打击感**：粒子特效、屏幕震动、击杀播报
- 🔊 **WebAudio 合成音效**：零外部音频资源，全部代码实时合成
- 📱 **H5 适配**：响应式布局，移动端可玩

![竞技场](docs/media/arena.jpg)

## 🛠 技术栈

React 19 · TypeScript · Canvas 2D 游戏循环 · Tailwind CSS · Vite · WebAudio API

游戏引擎在 [`src/game/`](src/game/)：`engine.ts`（循环）、`ai.ts`（机器人状态机）、`world.ts`（地图与碰撞）、`audio.ts`（合成音效）、`render.ts`（渲染）。

## 🐝 它是怎么被 K3 集群造出来的

这不是一次对话糊出来的 demo，而是 **Kimi K3 集群模式**多智能体协作的工程产物。整个过程中人类只输入了一句话：

> 「帮我做一个可实时对战的枪战游戏。」

### 1️⃣ 编排器先写执行计划

K3 没有急着写代码，而是先产出 [`docs/process/plan.md`](docs/process/plan.md)：玩法定义、技术选型、阶段划分、验收标准（"打开即玩 3 分钟对战 / 4 武器 3 道具 5 AI / 完整对局闭环"）。

### 2️⃣ 招募子代理，分工并行

| 子代理 | 任务 | 状态 |
|--------|------|------|
| 巴泰 | 脚手架：落地页 + 共享组件库 + 音效引擎 + 游戏常量 | ✅ 已解雇 |
| 泰吉 | 对战核心 `/play`：引擎、战斗、AI、HUD | ✅ 已解雇 |
| 鲍蒙 | 结算页 `/results` | ✅ 已解雇 |
| 费曼 | 武器库 + 玩法指南页 | ✅ 已解雇 |

### 3️⃣ 自己解决工程问题

终端记录里能看到集群自己处理真实世界的麻烦：`package-lock.json` 合并冲突还原重试、`git index.lock` 排查清理、三子代理并行构建、最终合并验证。

![K3 集群分工与排障](docs/media/swarm.jpg)

### 4️⃣ 交付

构建通过 → 版本快照 → 部署上线。从一句话到可玩游戏，全程无人工干预。

## 📂 目录结构

```
src/
├── game/          # 游戏引擎（循环/AI/渲染/音效/输入）
├── pages/         # 5 个页面：首页 / 对战 / 结算 / 武器库 / 指南
└── components/    # HUD、结算、内容组件
docs/process/      # K3 集群的过程产物（plan.md 等）
```

## 🎁 想亲手试试 Kimi K3？

通过我的邀请链接注册 Kimi，双方 100% 拿奖，最高可得 1 年会员等值权益 👉 [点击助力](https://kimi-bot.com/activities/zh-cn/viral-referral/share?scenario=invite&from=share_poster&invitation_code=YZYK4)

<a href="https://kimi-bot.com/activities/zh-cn/viral-referral/share?scenario=invite&from=share_poster&invitation_code=YZYK4">
  <img src="docs/referral.png" alt="Kimi 邀请海报" width="280">
</a>

---

同一个集群的另一个作品：[kimi-k3-worldcup-2026](https://github.com/genglintong/kimi-k3-worldcup-2026) —— 2026 世界杯里程碑动效网站。

由 [Kimi K3](https://www.kimi.com) 集群模式构建。觉得 AI 做的游戏还行，欢迎 ⭐。
