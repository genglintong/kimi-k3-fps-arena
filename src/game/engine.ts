/**
 * 游戏引擎：RAF 主循环（dt 上限 33ms）、比赛状态机、战斗结算、特效调度。
 * 纯 TS 实现，React 侧通过 onEvent + getHud() 桥接（HUD 轮询 100ms，事件即时）。
 *
 * 比赛流程（game.md §11）：COUNTDOWN(3.2s) → LIVE(180s) ⇄ PAUSED → END(2.5s) → /results
 * 时间到击杀数并列第一 → OVERTIME 30s 突然死亡（先杀人者胜；仍平 → 比死亡 → 比伤害）。
 */

import {
  WEAPONS,
  WEAPON_ORDER,
  WEAPON_SWITCH_MS,
  WEAPONBOX_WEIGHTS,
  ITEMS,
  BOT_ROSTER,
  BOT_EXTRA_POOL,
  DIFFICULTIES,
  MATCH_DURATION_S,
  LOW_TIME_WARNING_S,
  OVERTIME_S,
  RESPAWN_DELAY_S,
  RESPAWN_INVINCIBLE_S,
  SPAWN_MIN_ENEMY_DIST,
  COUNTDOWN_S,
  PLAYER_HP,
  PLAYER_SPEED,
  PLAYER_COLOR,
  PLAYER_NAME,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  COLORS,
  FIRST_BLOOD_TEXT,
  KILLSTREAKS,
  SCORE_PER_KILL,
} from './constants';
import type { WeaponId, DifficultyDef } from './constants';
import {
  createCharacter,
  createBrain,
  createBulletPool,
  createParticlePool,
  createDamageNumberPool,
  createDecalPool,
  allocBullet,
  allocParticle,
  allocDamageNumber,
  allocDecal,
  currentSlot,
  clampShield,
} from './entities';
import type { Character, Pad, Bullet, Particle, DamageNumber, Decal } from './entities';
import { PADS, SPAWN_POINTS, pickSpawnPoint, resolveCircleWorld, raycastCovers, hasLineOfSight, dist2, clamp } from './world';
import { updateBot, botSpeed } from './ai';
import type { AiContext } from './ai';
import { Renderer, VIEW_W, VIEW_H } from './render';
import type { RenderState } from './render';
import { Input } from './input';
import { audio } from './audio';
import type { MatchConfig, ArenaSettings } from './settings';

/* ------------------------------------------------------------------ */
/* 对外类型                                                            */
/* ------------------------------------------------------------------ */

export type Phase = 'loading' | 'countdown' | 'live' | 'end' | 'done';
export type AnnounceTone = 'white' | 'gold' | 'red' | 'gray';

export interface MatchResultEntry {
  id: string;
  name: string;
  color: string;
  isPlayer: boolean;
  kills: number;
  deaths: number;
  damage: number;
  streakBest: number;
}

export interface MatchResults {
  entries: MatchResultEntry[];
  winnerId: string;
  playerId: string;
  durationS: number;
  overtime: boolean;
  endedAt: number;
}

export type EngineEvent =
  | { type: 'countdown'; value: 3 | 2 | 1 | 'GO' | null }
  | {
      type: 'kill';
      killerId: string;
      killerName: string;
      killerColor: string;
      victimId: string;
      victimName: string;
      victimColor: string;
      weapon: WeaponId;
      involvesPlayer: boolean;
    }
  | { type: 'announce'; title: string; subtitle?: string; tone: AnnounceTone; confetti?: boolean }
  | { type: 'playerHit' }
  | { type: 'playerDeath'; killerName: string; weapon: WeaponId }
  | { type: 'playerRespawn' }
  | { type: 'lowTime'; seconds: number }
  | { type: 'overtime' }
  | { type: 'timeUp'; title: string }
  | { type: 'ammoDepleted'; name: string }
  | { type: 'weaponPickup'; weapon: WeaponId }
  | { type: 'paused'; paused: boolean }
  | { type: 'finished'; results: MatchResults };

export interface HudWeapon {
  id: WeaponId;
  owned: boolean;
  mag: number;
  reserve: number;
  current: boolean;
  reloading: boolean;
  reloadFrac: number;
}

export interface HudRow {
  id: string;
  name: string;
  color: string;
  kills: number;
  deaths: number;
  isPlayer: boolean;
}

export interface HudSnapshot {
  phase: Phase;
  paused: boolean;
  timeLeftS: number;
  overtime: boolean;
  lowTime: boolean;
  hp: number;
  shield: number;
  alive: boolean;
  respawnT: number;
  invincibleT: number;
  streak: number;
  kills: number;
  weapons: HudWeapon[];
  board: HudRow[];
  killerName: string;
  killerWeapon: WeaponId;
}

interface EngineOpts {
  canvas: HTMLCanvasElement;
  config: MatchConfig;
  settings: ArenaSettings;
  onEvent: (e: EngineEvent) => void;
}

const GUN_MUZZLE: Record<WeaponId, number> = { pistol: 26, shotgun: 34, rifle: 36, sniper: 40 };
/** 命中判定半径（角色 18 + 子弹 4 近似） */
const HIT_R = 20;
/** 霰弹射程外最大飞行距离倍数（超出衰减至 40%） */
const SHOTGUN_OVERSHOOT = 1.8;
/** 音效可闻距离（机器人枪声只在玩家附近播放，避免混音爆炸） */
const AUDIBLE_DIST = 950;

export class GameEngine {
  private renderer: Renderer;
  private input: Input;
  private onEvent: (e: EngineEvent) => void;
  private config: MatchConfig;
  private settings: ArenaSettings;
  private diff: DifficultyDef;

  private chars: Character[] = [];
  private player!: Character;
  private pads: Pad[] = [];
  private bullets: Bullet[] = createBulletPool();
  private particles: Particle[] = createParticlePool();
  private damageNumbers: DamageNumber[] = createDamageNumberPool();
  private decals: Decal[] = createDecalPool();
  private particleCursor = { i: 0 };

  private phase: Phase = 'loading';
  private paused = false;
  /** 游戏内累计秒（慢动作下减速） */
  private now = 0;
  private frame = 0;
  private timeLeft = MATCH_DURATION_S;
  private matchTime = 0;
  private overtime = false;
  private countdownT = COUNTDOWN_S;
  private countdownStep = 3;
  private goT = 0;
  private endT = 0;
  private endTitle = '时间到！';
  private winnerId: string | null = null;
  private finishedEmitted = false;
  private firstBloodDone = false;
  private lastWholeSecond = -1;
  private timeScale = 1;

  private camX = WORLD_WIDTH / 2;
  private camY = WORLD_HEIGHT / 2;
  private zoom = 1.6;
  private introT = 0;
  private snapT = 0;
  private trauma = 0;

  private crosshair = { spreadDeg: 0, hoverEnemy: false, hitT: 0, hitKill: false, visible: false };
  private mouseWorld = { x: 0, y: 0 };
  private moveAxis = { x: 0, y: 0 };
  private aiCtx: AiContext;
  private rs: RenderState;

  private raf = 0;
  private lastTs = 0;
  private destroyed = false;

  constructor(opts: EngineOpts) {
    this.renderer = new Renderer(opts.canvas);
    this.config = opts.config;
    this.settings = opts.settings;
    this.onEvent = opts.onEvent;
    this.diff = DIFFICULTIES[opts.config.difficulty];
    this.aiCtx = { chars: this.chars, pads: this.pads, diff: this.diff, now: 0, frame: 0 };
    this.input = new Input(opts.canvas, {
      onSlotKey: (i) => this.playerSlotKey(i),
      onReload: () => this.startReload(this.player),
      onCycle: (dir) => this.cycleWeapon(dir),
      onPause: () => this.togglePause(),
    });
    this.rs = {
      chars: this.chars,
      pads: this.pads,
      bullets: this.bullets,
      particles: this.particles,
      damageNumbers: this.damageNumbers,
      decals: this.decals,
      camX: 0,
      camY: 0,
      zoom: 1,
      shakeX: 0,
      shakeY: 0,
      shakeRot: 0,
      mouseX: 0,
      mouseY: 0,
      crosshair: this.crosshair,
      now: 0,
      playerId: 'player',
      endBubbles: false,
      winnerId: null,
      showDamageNumbers: true,
    };
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /* ---------------------------------------------------------------- */
  /* 生命周期                                                          */
  /* ---------------------------------------------------------------- */

  async start(): Promise<void> {
    await this.loadFonts();
    if (this.destroyed) return;
    this.renderer.prerender();
    this.setupMatch();
    this.phase = 'countdown';
    this.emit({ type: 'countdown', value: 3 });
    audio.playCountdownBeep();
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private async loadFonts(): Promise<void> {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('16px Bungee'),
          document.fonts.load('24px Bungee'),
          document.fonts.load('700 12px "Noto Sans SC"'),
          document.fonts.load('40px "ZCOOL KuaiLe"'),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* 字体失败不阻塞游戏 */
    }
  }

  private setupMatch(): void {
    // 出生点随机分配（玩家 + N 机器人各占一个）
    const indices = SPAWN_POINTS.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const pSpawn = SPAWN_POINTS[indices[0]];
    this.player = createCharacter({
      id: 'player',
      name: PLAYER_NAME,
      color: PLAYER_COLOR,
      colorDark: COLORS.bluDark,
      isPlayer: true,
      personality: null,
      x: pSpawn[0],
      y: pSpawn[1],
    });
    this.player.invincibleT = COUNTDOWN_S;
    this.player.spawnT = 0.3;
    this.chars.push(this.player);

    const bots = [...BOT_ROSTER, ...BOT_EXTRA_POOL].slice(0, this.config.botCount);
    bots.forEach((def, i) => {
      const sp = SPAWN_POINTS[indices[(i + 1) % indices.length]];
      const bot = createCharacter({
        id: def.id,
        name: def.name,
        color: def.color,
        colorDark: def.colorDark,
        isPlayer: false,
        personality: def.personality,
        x: sp[0],
        y: sp[1],
      });
      bot.brain = createBrain(i % 2);
      bot.spawnT = 0.3;
      this.chars.push(bot);
    });

    this.pads.length = 0;
    for (const def of PADS) {
      this.pads.push({
        type: def.type,
        x: def.x,
        y: def.y,
        present: true,
        timer: 0,
        total: ITEMS[def.type].respawnS,
        phase: Math.random() * Math.PI * 2,
        popT: 0,
      });
    }
    this.camX = this.player.x;
    this.camY = this.player.y;
    this.zoom = 1.6;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    audio.stopHeartbeat();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onResize = (): void => {
    this.renderer.resize();
  };

  private onVisibility = (): void => {
    if (document.hidden && this.phase === 'live' && !this.paused) {
      this.togglePause();
    }
  };

  /* ---------------------------------------------------------------- */
  /* 主循环                                                            */
  /* ---------------------------------------------------------------- */

  private loop = (ts: number): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.033) dt = 0.033; // dt 上限 33ms
    if (dt < 0) dt = 0;
    this.frame++;
    if (!this.paused && this.phase !== 'loading' && this.phase !== 'done') {
      this.update(dt);
    }
    this.render();
    this.input.endFrame();
  };

  private update(rdt: number): void {
    /* ---- 终结慢动作时间曲线（game.md §9.5） ---- */
    if (this.phase === 'end') {
      this.endT += rdt;
      const t = this.endT;
      if (t < 0.2) this.timeScale = 1 - (t / 0.2) * 0.75;
      else if (t < 1.4) this.timeScale = 0.25;
      else if (t < 1.8) this.timeScale = 0.25 + ((t - 1.4) / 0.4) * 0.75;
      else this.timeScale = 1;
      if (t >= 2.5 && !this.finishedEmitted) {
        this.finishMatch();
      }
    } else {
      this.timeScale = 1;
    }
    const sdt = rdt * this.timeScale;
    this.now += sdt;
    this.aiCtx.now = this.now;
    this.aiCtx.frame = this.frame;

    /* ---- 倒计时 ---- */
    if (this.phase === 'countdown') {
      this.introT += rdt;
      const zt = Math.min(this.introT / 1.2, 1);
      const ease = 1 - Math.pow(1 - zt, 5); // ease-snap（easeOutQuint）
      this.zoom = 1.6 - 0.6 * ease;
      this.countdownT -= rdt;
      if (this.countdownStep === 3 && this.countdownT <= COUNTDOWN_S - 1) {
        this.countdownStep = 2;
        this.emit({ type: 'countdown', value: 2 });
        audio.playCountdownBeep();
      } else if (this.countdownStep === 2 && this.countdownT <= COUNTDOWN_S - 2) {
        this.countdownStep = 1;
        this.emit({ type: 'countdown', value: 1 });
        audio.playCountdownBeep();
      } else if (this.countdownT <= 0) {
        this.phase = 'live';
        this.emit({ type: 'countdown', value: 'GO' });
        audio.playCountdownGo();
        this.goT = 0.6;
      }
    }
    if (this.goT > 0) {
      this.goT -= rdt;
      if (this.goT <= 0) this.emit({ type: 'countdown', value: null });
    }

    /* ---- 比赛计时 ---- */
    if (this.phase === 'live') {
      this.matchTime += sdt;
      this.timeLeft -= sdt;
      if (!this.overtime) {
        if (this.timeLeft <= LOW_TIME_WARNING_S && this.timeLeft > 0) {
          const whole = Math.ceil(this.timeLeft);
          if (whole !== this.lastWholeSecond) {
            this.lastWholeSecond = whole;
            audio.playLowTimeWarning();
            this.emit({ type: 'lowTime', seconds: whole });
          }
        }
        if (this.timeLeft <= 0) {
          if (this.isKillsTiedAtTop()) {
            this.overtime = true;
            this.timeLeft = OVERTIME_S;
            this.emit({ type: 'overtime' });
            this.emit({
              type: 'announce',
              title: '加时！',
              subtitle: '突然死亡 · 先杀人者胜',
              tone: 'gold',
            });
          } else {
            this.endMatch(null);
          }
        }
      } else if (this.timeLeft <= 0) {
        this.endMatch(null);
      }
    }

    /* ---- 角色 ---- */
    for (const c of this.chars) this.updateCharacter(c, sdt);
    this.separateCharacters();
    /* ---- 子弹 / 粒子 / 飘字 / 凹痕 / 道具台 ---- */
    this.updateBullets(sdt);
    this.updateParticles(sdt);
    this.updateDamageNumbers(sdt);
    this.updateDecals(sdt);
    this.updatePads(sdt);
    /* ---- 相机 ---- */
    this.updateCamera(rdt);
    /* ---- 震动衰减 ---- */
    this.trauma = Math.max(0, this.trauma - 1.6 * rdt);
    this.crosshair.hitT = Math.max(0, this.crosshair.hitT - rdt);
    this.updateCrosshairHover();
    /* ---- 心跳（HP<30） ---- */
    if (
      this.phase === 'live' &&
      this.player.alive &&
      this.player.hp < 30 &&
      !this.paused &&
      this.settings.sound
    ) {
      audio.startHeartbeat();
    } else {
      audio.stopHeartbeat();
    }
  }

  private emit(e: EngineEvent): void {
    this.onEvent(e);
  }

  /* ---------------------------------------------------------------- */
  /* 角色更新                                                          */
  /* ---------------------------------------------------------------- */

  private updateCharacter(c: Character, sdt: number): void {
    /* 计时器（表现层用真实 dt 的等比缩放即可，统一 sdt） */
    c.sinceShot += sdt;
    c.sinceTrigger += sdt;
    c.hitFlashT = Math.max(0, c.hitFlashT - sdt);
    c.muzzleT = Math.max(0, c.muzzleT - sdt);
    c.recoilT = Math.max(0, c.recoilT - sdt);
    c.spawnT = Math.max(0, c.spawnT - sdt);
    c.invincibleT = Math.max(0, c.invincibleT - sdt);
    c.switchT = Math.max(0, c.switchT - sdt);
    c.knockX *= Math.max(0, 1 - 30 * sdt);
    c.knockY *= Math.max(0, 1 - 30 * sdt);
    // 步枪停射 0.4s 后散布回落
    const ramp = WEAPONS[WEAPON_ORDER[c.slot]].spreadRamp;
    if (ramp && c.sinceTrigger > ramp.recoverMs / 1000 && c.bloomDeg > 0) {
      c.bloomDeg = Math.max(0, c.bloomDeg - 30 * sdt);
    }
    // 换弹完成
    if (c.reloadT > 0) {
      c.reloadT -= sdt;
      if (c.reloadT <= 0) {
        c.reloadT = 0;
        const w = WEAPONS[WEAPON_ORDER[c.slot]];
        const slot = currentSlot(c);
        const take = Math.min(w.magazine - slot.mag, slot.reserve);
        slot.mag += take;
        if (slot.reserve !== Infinity) slot.reserve -= take;
      }
    }

    if (!c.alive) {
      c.deadT += sdt;
      if (this.phase === 'live') {
        c.respawnT -= sdt;
        if (c.respawnT <= 0) this.respawn(c);
      }
      return;
    }

    /* ---- 移动意图 ---- */
    let mx = 0;
    let my = 0;
    let speed = 0;
    if (c.isPlayer) {
      this.input.moveAxis(this.moveAxis);
      mx = this.moveAxis.x;
      my = this.moveAxis.y;
      speed = PLAYER_SPEED;
      // 瞄准：鼠标世界坐标
      this.renderer.screenToWorld(this.input.mouseX, this.input.mouseY, this.camX, this.camY, this.zoom, this.mouseWorld);
      c.aim = Math.atan2(this.mouseWorld.y - c.y, this.mouseWorld.x - c.x);
      // 开火（仅 LIVE；半自动吃点击沿，全自动吃按住）
      if (this.phase === 'live') {
        const w = WEAPONS[WEAPON_ORDER[c.slot]];
        if ((w.auto && this.input.firing) || (!w.auto && this.input.clickEdge)) {
          this.tryFire(c);
        }
      }
    } else if (c.brain) {
      updateBot(c, this.aiCtx, sdt);
      const b = c.brain;
      mx = b.moveX;
      my = b.moveY;
      speed = botSpeed(c, this.aiCtx);
      if (b.wantFire || b.targetVisible) {
        c.aim = Math.atan2(b.aimY - c.y, b.aimX - c.x);
      } else if (mx !== 0 || my !== 0) {
        // 无目标时朝向移动方向（平滑转身）
        const want = Math.atan2(my, mx);
        let diff = want - c.aim;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.aim += diff * Math.min(1, 10 * sdt);
      } else if (b.aimX !== 0 || b.aimY !== 0) {
        c.aim = Math.atan2(b.aimY - c.y, b.aimX - c.x);
      }
      if (this.phase === 'live' && b.wantFire) {
        this.tryFire(c);
      }
      // 机器人自动换弹
      const slot = currentSlot(c);
      if (slot.mag === 0 && slot.reserve > 0 && c.reloadT <= 0) {
        this.startReload(c);
      } else if (
        slot.mag > 0 &&
        slot.mag <= WEAPONS[WEAPON_ORDER[c.slot]].magazine * 0.25 &&
        !b.targetVisible &&
        c.reloadT <= 0 &&
        slot.reserve > 0
      ) {
        this.startReload(c);
      }
    }

    c.vx = mx * speed;
    c.vy = my * speed;
    c.x += c.vx * sdt;
    c.y += c.vy * sdt;
    resolveCircleWorld(c, c.radius);

    const spd = Math.hypot(c.vx, c.vy);
    c.moving = spd > 10;
    if (c.moving) {
      c.jellyPhase += sdt * 50; // ≈8Hz
      c.idleT = 0;
    } else {
      c.idleT += sdt;
    }

    /* ---- 道具拾取 ---- */
    for (const pad of this.pads) {
      if (!pad.present) continue;
      const rr = c.radius + 24;
      if (dist2(c.x, c.y, pad.x, pad.y) < rr * rr) {
        this.pickup(c, pad);
      }
    }
  }

  private separateCharacters(): void {
    for (let i = 0; i < this.chars.length; i++) {
      const a = this.chars[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.chars.length; j++) {
        const b = this.chars[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (rr - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  private respawn(c: Character): void {
    const enemies = this.chars.filter((o) => o !== c);
    const [sx, sy] = pickSpawnPoint(enemies, SPAWN_MIN_ENEMY_DIST);
    c.x = sx;
    c.y = sy;
    c.hp = PLAYER_HP;
    c.shield = 0;
    c.alive = true;
    c.deadT = 0;
    c.invincibleT = RESPAWN_INVINCIBLE_S;
    c.spawnT = 0.3;
    c.reloadT = 0;
    c.switchT = 0;
    c.bloomDeg = 0;
    c.hitFlashT = 0;
    if (c.brain) {
      const b = c.brain;
      b.state = 'patrol';
      b.targetId = null;
      b.targetVisible = false;
      b.repathT = 0;
      b.seekPad = -1;
      b.lastHurtAt = -999;
    }
    if (c.isPlayer) {
      this.emit({ type: 'playerRespawn' });
      this.snapT = 0.3; // 镜头快速居中（300ms）
    }
    // 出生星星
    this.spawnStars(c.x, c.y, 8, '#FFFFFF', 4, 120, 0, 0.4);
  }

  /* ---------------------------------------------------------------- */
  /* 武器与战斗                                                        */
  /* ---------------------------------------------------------------- */

  private playerSlotKey(i: number): void {
    if (this.phase !== 'live' || !this.player.alive) return;
    this.switchTo(this.player, i);
  }

  private cycleWeapon(dir: 1 | -1): void {
    if (this.phase !== 'live' || !this.player.alive) return;
    const c = this.player;
    for (let n = 1; n <= 4; n++) {
      const idx = (c.slot + dir * n + 4 * 4) % 4;
      if (c.slots[idx].owned) {
        this.switchTo(c, idx);
        return;
      }
    }
  }

  private switchTo(c: Character, idx: number): void {
    if (idx === c.slot || !c.slots[idx].owned) return;
    c.slot = idx;
    c.switchT = WEAPON_SWITCH_MS / 1000;
    c.reloadT = 0; // 换弹被打断，弹匣保留原量
    if (c.isPlayer) audio.playReload();
  }

  private startReload(c: Character): void {
    const w = WEAPONS[WEAPON_ORDER[c.slot]];
    const slot = currentSlot(c);
    if (c.reloadT > 0 || c.switchT > 0) return;
    if (slot.mag >= w.magazine || slot.reserve <= 0) return;
    if (c.isPlayer && this.phase !== 'live') return;
    c.reloadTotal = w.reloadMs / 1000;
    c.reloadT = c.reloadTotal;
    if (c.isPlayer || this.distToPlayer2(c) < AUDIBLE_DIST * AUDIBLE_DIST) audio.playReload();
  }

  private tryFire(c: Character): boolean {
    const wid = WEAPON_ORDER[c.slot];
    const w = WEAPONS[wid];
    const slot = currentSlot(c);
    if (c.switchT > 0 || c.reloadT > 0) return false;
    if (c.sinceShot < w.fireIntervalMs / 1000) return false;
    if (slot.mag <= 0) {
      if (slot.reserve > 0) {
        this.startReload(c);
      } else if (wid !== 'pistol') {
        this.depleteWeapon(c);
      } else if (c.isPlayer) {
        audio.playEmpty();
      }
      return false;
    }
    slot.mag--;
    c.sinceShot = 0;
    c.sinceTrigger = 0;
    c.muzzleT = 0.06;
    c.muzzleRot = Math.random() * Math.PI * 2;
    c.recoilT = 0.08;

    let spreadDeg = w.spreadDeg + c.bloomDeg;
    if (w.spreadRamp) {
      c.bloomDeg = Math.min(
        c.bloomDeg + w.spreadRamp.perShotDeg,
        w.spreadRamp.maxSpreadDeg - w.spreadDeg,
      );
    }
    for (let i = 0; i < w.pellets; i++) {
      const off = ((Math.random() * 2 - 1) * spreadDeg * Math.PI) / 180;
      this.spawnBullet(c, c.aim + off, wid);
    }

    if (c.isPlayer) {
      audio.playShot(wid);
      this.addTrauma(wid === 'sniper' ? 0.18 : 0.06);
    } else if (this.distToPlayer2(c) < AUDIBLE_DIST * AUDIBLE_DIST) {
      audio.playShot(wid);
    }

    // 弹尽回手枪（game.md §6.1）
    if (slot.mag === 0 && slot.reserve === 0 && wid !== 'pistol') {
      this.depleteWeapon(c);
    }
    return true;
  }

  private depleteWeapon(c: Character): void {
    const wid = WEAPON_ORDER[c.slot];
    c.slots[c.slot] = { owned: false, mag: 0, reserve: 0 };
    c.slot = 0;
    c.switchT = WEAPON_SWITCH_MS / 1000;
    c.reloadT = 0;
    if (c.isPlayer) {
      audio.playEmpty();
      this.emit({ type: 'ammoDepleted', name: WEAPONS[wid].name });
    }
  }

  private spawnBullet(c: Character, angle: number, wid: WeaponId): void {
    const b = allocBullet(this.bullets);
    if (!b) return;
    const w = WEAPONS[wid];
    const muzzle = c.radius + GUN_MUZZLE[wid] - 4;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    b.active = true;
    b.x = c.x + dx * muzzle;
    b.y = c.y + dy * muzzle;
    b.px = b.x;
    b.py = b.y;
    b.vx = dx * w.bulletSpeed;
    b.vy = dy * w.bulletSpeed;
    b.traveled = 0;
    b.range = w.range;
    b.maxDist = wid === 'shotgun' ? w.range * SHOTGUN_OVERSHOOT : w.range;
    b.damage = w.damage;
    b.falloff = w.falloff ?? 1;
    b.pierceLeft = w.pierce ?? 0;
    b.firstHitId = null;
    b.ownerId = c.id;
    b.weapon = wid;
    b.color = w.color;
  }

  private updateBullets(sdt: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      const step = Math.hypot(b.x - b.px, b.y - b.py);
      b.traveled += step;

      // 扫掠：先算掩体最早命中
      const tWall = raycastCovers(b.px, b.py, b.x, b.y);
      // 角色命中（优先级 角色 > 掩体 > 边界）
      let hitChar: Character | null = null;
      let tChar = Infinity;
      for (const c of this.chars) {
        if (!c.alive || c.id === b.ownerId || c.invincibleT > 0) continue;
        if (b.firstHitId === c.id) continue;
        const t = this.segCircle(b.px, b.py, b.x, b.y, c.x, c.y, HIT_R);
        if (t < tChar) {
          tChar = t;
          hitChar = c;
        }
      }

      if (hitChar && tChar <= Math.min(tWall, 1)) {
        // 命中角色
        const hx = b.px + (b.x - b.px) * tChar;
        const hy = b.py + (b.y - b.py) * tChar;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        let dmg = b.damage;
        if (b.traveled > b.range && b.maxDist > b.range) {
          const f = clamp((b.traveled - b.range) / (b.maxDist - b.range), 0, 1);
          dmg = b.damage * (1 + (b.falloff - 1) * f);
        }
        const owner = this.chars.find((c) => c.id === b.ownerId) ?? null;
        if (owner) {
          this.applyDamage(hitChar, owner, dmg, b.weapon, hx, hy, b.vx / sp, b.vy / sp);
        }
        if (b.pierceLeft > 0 && hitChar.alive) {
          // 狙击穿透：第二目标伤害 ×0.6
          b.pierceLeft--;
          b.firstHitId = hitChar.id;
          b.damage *= 0.6;
          b.x += (b.vx / sp) * (HIT_R * 2 + 4);
          b.y += (b.vy / sp) * (HIT_R * 2 + 4);
        } else if (b.pierceLeft > 0 && !hitChar.alive) {
          b.pierceLeft--;
          b.firstHitId = hitChar.id;
          b.damage *= 0.6;
        } else {
          b.active = false;
        }
        continue;
      }

      if (tWall <= 1) {
        // 命中掩体：尘雾 5 粒 + 凹痕
        const hx = b.px + (b.x - b.px) * tWall;
        const hy = b.py + (b.y - b.py) * tWall;
        this.spawnDust(hx, hy, 5);
        const decal = allocDecal(this.decals);
        decal.active = true;
        decal.x = hx;
        decal.y = hy;
        decal.t = 0;
        b.active = false;
        continue;
      }

      if (
        b.traveled >= b.maxDist ||
        b.x < 0 ||
        b.x > WORLD_WIDTH ||
        b.y < 0 ||
        b.y > WORLD_HEIGHT
      ) {
        b.active = false;
      }
    }
  }

  private segCircle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    cx: number,
    cy: number,
    r: number,
  ): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const fx = x0 - cx;
    const fy = y0 - cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-9) return Infinity;
    const b = 2 * (fx * dx + fy * dy);
    const cc = fx * fx + fy * fy - r * r;
    if (cc <= 0) return 0;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return Infinity;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : Infinity;
  }

  private applyDamage(
    victim: Character,
    attacker: Character,
    dmg: number,
    weapon: WeaponId,
    hx: number,
    hy: number,
    dirX: number,
    dirY: number,
  ): void {
    if (!victim.alive || victim.invincibleT > 0) return;
    const absorbed = Math.min(victim.shield, dmg);
    victim.shield -= absorbed;
    const hpDmg = dmg - absorbed;
    victim.hp -= hpDmg;
    attacker.damage += dmg;
    victim.hitFlashT = 0.08;
    victim.knockX = dirX * 4;
    victim.knockY = dirY * 4;
    if (victim.brain) victim.brain.lastHurtAt = this.now;

    const crit = dmg >= 40;
    // 命中火花 8–10 粒（角色色 + 白）
    this.spawnHitSparks(hx, hy, victim.color, crit);
    // 伤害飘字
    if (this.settings.damageNumbers) {
      this.spawnDamageNumber(
        hx,
        hy - 20,
        String(Math.round(dmg)),
        crit ? 20 : 16,
        crit ? COLORS.yel : '#FFFFFF',
      );
    }
    if (attacker.isPlayer) {
      this.crosshair.hitT = 0.15;
      this.crosshair.hitKill = false;
      audio.playHit();
      this.addTrauma(0.08);
    }
    if (victim.isPlayer) {
      this.addTrauma(0.22);
      this.emit({ type: 'playerHit' });
    }
    if (victim.hp <= 0) {
      this.kill(victim, attacker, weapon);
    }
  }

  private kill(victim: Character, killer: Character, weapon: WeaponId): void {
    victim.alive = false;
    victim.deadT = 0;
    victim.deaths++;
    victim.respawnT = RESPAWN_DELAY_S;
    victim.lastKillerName = killer.name;
    victim.lastKillerWeapon = weapon;
    // 玩家连杀中断播报
    if (victim.isPlayer && victim.streak >= 3) {
      this.emit({ type: 'announce', title: '连杀终结', tone: 'gray' });
    }
    victim.streak = 0;

    killer.kills += SCORE_PER_KILL;
    killer.streak++;
    killer.streakBest = Math.max(killer.streakBest, killer.streak);

    // 死亡演出：24 粒角色色星星爆环 + 幽灵 + 冲击环
    this.spawnDeathBurst(victim.x, victim.y, victim.color);

    // 震动：自己死亡 +0.6；附近死亡（<300u）+0.3
    if (victim.isPlayer) this.addTrauma(0.6);
    else if (this.distToPlayer2(victim) < 300 * 300) this.addTrauma(0.3);

    // 音效
    if (victim.isPlayer) audio.playDeath();
    if (killer.isPlayer) {
      audio.playKill();
      this.crosshair.hitT = 0.15;
      this.crosshair.hitKill = true;
    }
    // K.O. 飘字（不受伤害数字开关影响，属击杀确认）
    this.spawnDamageNumber(victim.x, victim.y - 30, 'K.O.', 24, COLORS.red);

    // 击杀播报流
    this.emit({
      type: 'kill',
      killerId: killer.id,
      killerName: killer.name,
      killerColor: killer.color,
      victimId: victim.id,
      victimName: victim.name,
      victimColor: victim.color,
      weapon,
      involvesPlayer: killer.isPlayer || victim.isPlayer,
    });
    if (victim.isPlayer) {
      this.emit({ type: 'playerDeath', killerName: killer.name, weapon });
    }

    // 第一滴血
    if (!this.firstBloodDone) {
      this.firstBloodDone = true;
      audio.playFirstBlood();
      this.emit({
        type: 'announce',
        title: FIRST_BLOOD_TEXT,
        subtitle: `${killer.name} 拿下首杀`,
        tone: killer.isPlayer ? 'gold' : 'white',
        confetti: killer.isPlayer,
      });
    }
    // 连杀播报
    for (const ks of KILLSTREAKS) {
      if (killer.streak === ks.streak) {
        audio.playKillstreak(killer.streak);
        this.emit({
          type: 'announce',
          title: `${killer.name} ${ks.text}`,
          tone: killer.isPlayer ? 'gold' : 'white',
          confetti: killer.isPlayer,
        });
      }
    }
    // 玩家击杀确认
    if (killer.isPlayer) {
      this.emit({
        type: 'announce',
        title: `你淘汰了 ${victim.name}！`,
        subtitle: '+1 击杀',
        tone: 'white',
      });
    }

    // 加时突然死亡：先杀人者胜
    if (this.overtime && this.phase === 'live') {
      this.endMatch(killer.id);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 道具                                                              */
  /* ---------------------------------------------------------------- */

  private pickup(c: Character, pad: Pad): void {
    const def = ITEMS[pad.type];
    // 满状态不拾取（避免浪费刷新）
    if (pad.type === 'medkit' && c.hp >= PLAYER_HP) return;
    if (pad.type === 'shield' && c.shield >= 100) return;

    pad.present = false;
    pad.timer = def.respawnS;
    pad.total = def.respawnS;

    const near = c.isPlayer || this.distToPlayer2(c) < AUDIBLE_DIST * AUDIBLE_DIST;
    if (pad.type === 'medkit') {
      c.hp = Math.min(PLAYER_HP, c.hp + def.value);
      this.spawnDamageNumber(pad.x, pad.y - 24, `+${def.value}`, 16, COLORS.grn);
      if (near) audio.playPickup('medkit');
    } else if (pad.type === 'shield') {
      c.shield = clampShield(c.shield + def.value);
      this.spawnDamageNumber(pad.x, pad.y - 24, `+${def.value}`, 16, COLORS.blu);
      if (near) audio.playPickup('shield');
    } else {
      // 武器箱：加权随机（步枪 40% / 霰弹 35% / 狙击 25%）；神枪阿亮只捡狙击
      const wid = c.personality === 'sniper' ? 'sniper' : this.rollWeaponBox();
      this.grantWeapon(c, wid);
      this.spawnDamageNumber(pad.x, pad.y - 24, WEAPONS[wid].name, 16, COLORS.pur);
      if (near) audio.playPickup('weaponbox');
      if (c.isPlayer) this.emit({ type: 'weaponPickup', weapon: wid });
    }
    // 拾取星星
    this.spawnStars(pad.x, pad.y, 8, def.color, 4, 140, 0, 0.4);
  }

  private rollWeaponBox(): WeaponId {
    const r = Math.random();
    let acc = 0;
    for (const w of WEAPONBOX_WEIGHTS) {
      acc += w.weight;
      if (r < acc) return w.weapon;
    }
    return WEAPONBOX_WEIGHTS[WEAPONBOX_WEIGHTS.length - 1].weapon;
  }

  private grantWeapon(c: Character, wid: WeaponId): void {
    const idx = WEAPON_ORDER.indexOf(wid);
    const w = WEAPONS[wid];
    c.slots[idx] = { owned: true, mag: w.magazine, reserve: w.ammoReserve };
    this.switchTo(c, idx);
  }

  private updatePads(sdt: number): void {
    for (const pad of this.pads) {
      pad.popT = Math.max(0, pad.popT - sdt);
      if (!pad.present) {
        pad.timer -= sdt;
        if (pad.timer <= 0) {
          pad.present = true;
          pad.popT = 0.3;
          this.spawnStars(pad.x, pad.y, 6, ITEMS[pad.type].color, 4, 100, 0, 0.35);
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* 特效                                                              */
  /* ---------------------------------------------------------------- */

  private addTrauma(v: number): void {
    if (!this.settings.shake) return;
    this.trauma = Math.min(1, this.trauma + v);
  }

  private spawnHitSparks(x: number, y: number, color: string, crit: boolean): void {
    const n = 8 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 140;
      const p = allocParticle(this.particles, this.particleCursor);
      p.active = true;
      p.kind = 0;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = 0.3 + Math.random() * 0.1;
      p.life = p.maxLife;
      p.size = 4 + Math.random() * 3;
      p.color = i % 2 === 0 ? color : '#FFFFFF';
      p.gravity = 400;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 12;
    }
    if (crit) {
      // 暴击：+4 大星 + 冲击环
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.random() * 0.6;
        const p = allocParticle(this.particles, this.particleCursor);
        p.active = true;
        p.kind = 0;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * 300;
        p.vy = Math.sin(a) * 300;
        p.maxLife = 0.4;
        p.life = 0.4;
        p.size = 8;
        p.color = COLORS.yel;
        p.gravity = 400;
        p.rot = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 10;
      }
      this.spawnRing(x, y, '#FFFFFF');
    }
  }

  private spawnDeathBurst(x: number, y: number, color: string): void {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const sp = 180 + Math.random() * 120;
      const p = allocParticle(this.particles, this.particleCursor);
      p.active = true;
      p.kind = 0;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = 0.45 + Math.random() * 0.15;
      p.life = p.maxLife;
      p.size = 5 + Math.random() * 4;
      p.color = i % 3 === 0 ? '#FFFFFF' : color;
      p.gravity = 300;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 12;
    }
    // 幽灵表情上飘
    const g = allocParticle(this.particles, this.particleCursor);
    g.active = true;
    g.kind = 3;
    g.x = x;
    g.y = y - 10;
    g.vx = 0;
    g.vy = -70;
    g.maxLife = 0.8;
    g.life = 0.8;
    g.size = 1;
    g.color = '#FFFFFF';
    g.gravity = 0;
    g.rot = 0;
    g.vr = 0;
    this.spawnRing(x, y, color);
  }

  private spawnRing(x: number, y: number, color: string): void {
    const p = allocParticle(this.particles, this.particleCursor);
    p.active = true;
    p.kind = 2;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.maxLife = 0.2;
    p.life = 0.2;
    p.size = 8;
    p.color = color;
    p.gravity = 0;
    p.rot = 0;
    p.vr = 0;
  }

  private spawnDust(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 70;
      const p = allocParticle(this.particles, this.particleCursor);
      p.active = true;
      p.kind = 1;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = 0.25 + Math.random() * 0.15;
      p.life = p.maxLife;
      p.size = 3 + Math.random() * 3;
      p.color = 'rgba(220,220,230,1)';
      p.gravity = 0;
      p.rot = 0;
      p.vr = 0;
    }
  }

  private spawnStars(
    x: number,
    y: number,
    n: number,
    color: string,
    size: number,
    speed: number,
    gravity: number,
    life: number,
  ): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const p = allocParticle(this.particles, this.particleCursor);
      p.active = true;
      p.kind = 4;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed - 40;
      p.maxLife = life;
      p.life = life;
      p.size = size + Math.random() * 2;
      p.color = color;
      p.gravity = gravity;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 10;
    }
  }

  private spawnDamageNumber(x: number, y: number, text: string, size: number, color: string): void {
    const d = allocDamageNumber(this.damageNumbers);
    d.active = true;
    d.x = x + (Math.random() - 0.5) * 12;
    d.y = y;
    d.t = 0;
    d.life = 0.6;
    d.text = text;
    d.size = size;
    d.color = color;
  }

  private updateParticles(sdt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= sdt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * sdt;
      p.x += p.vx * sdt;
      p.y += p.vy * sdt;
      p.rot += p.vr * sdt;
    }
  }

  private updateDamageNumbers(sdt: number): void {
    for (const d of this.damageNumbers) {
      if (!d.active) continue;
      d.t += sdt;
      if (d.t >= d.life) d.active = false;
    }
  }

  private updateDecals(sdt: number): void {
    for (const d of this.decals) {
      if (!d.active) continue;
      d.t += sdt;
      if (d.t >= d.life) d.active = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /* 相机 / 准星                                                       */
  /* ---------------------------------------------------------------- */

  private updateCamera(rdt: number): void {
    let tx = this.player.x;
    let ty = this.player.y;
    if (this.phase === 'end' && this.winnerId) {
      // 镜头推向胜者方向
      const winner = this.chars.find((c) => c.id === this.winnerId);
      if (winner && winner.alive) {
        tx = this.player.x + (winner.x - this.player.x) * 0.6;
        ty = this.player.y + (winner.y - this.player.y) * 0.6;
      }
    } else if (this.player.alive && this.input.mouseActive) {
      // 鼠标方向前瞻（最多 60u，系数 0.15）
      let lx = (this.mouseWorld.x - this.player.x) * 0.15;
      let ly = (this.mouseWorld.y - this.player.y) * 0.15;
      const ll = Math.hypot(lx, ly);
      if (ll > 60) {
        lx = (lx / ll) * 60;
        ly = (ly / ll) * 60;
      }
      tx += lx;
      ty += ly;
    }
    this.snapT = Math.max(0, this.snapT - rdt);
    const k = Math.min(1, (this.snapT > 0 ? 0.35 : 0.12) * rdt * 60);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    // 边界 clamp：视口不越出世界
    const viewW = VIEW_W / this.zoom;
    const viewH = VIEW_H / this.zoom;
    this.camX =
      viewW >= WORLD_WIDTH ? WORLD_WIDTH / 2 : clamp(this.camX, viewW / 2, WORLD_WIDTH - viewW / 2);
    this.camY =
      viewH >= WORLD_HEIGHT
        ? WORLD_HEIGHT / 2
        : clamp(this.camY, viewH / 2, WORLD_HEIGHT - viewH / 2);
  }

  private updateCrosshairHover(): void {
    const show =
      (this.phase === 'live' || this.phase === 'countdown') &&
      !this.paused &&
      this.player.alive &&
      this.input.mouseActive;
    this.crosshair.visible = show;
    if (!show) return;
    const w = WEAPONS[WEAPON_ORDER[this.player.slot]];
    this.crosshair.spreadDeg = w.spreadDeg + this.player.bloomDeg;
    // 悬停敌人：鼠标世界点附近 26u 有存活敌人且视线可达
    let hover = false;
    for (const c of this.chars) {
      if (c.isPlayer || !c.alive) continue;
      if (dist2(c.x, c.y, this.mouseWorld.x, this.mouseWorld.y) < 26 * 26) {
        if (hasLineOfSight(this.player.x, this.player.y, c.x, c.y)) {
          hover = true;
          break;
        }
      }
    }
    this.crosshair.hoverEnemy = hover;
  }

  /* ---------------------------------------------------------------- */
  /* 比赛结束                                                          */
  /* ---------------------------------------------------------------- */

  private isKillsTiedAtTop(): boolean {
    let top = 0;
    for (const c of this.chars) top = Math.max(top, c.kills);
    let n = 0;
    for (const c of this.chars) if (c.kills === top) n++;
    return n >= 2;
  }

  private computeWinnerId(): string {
    // 击杀多 → 死亡少 → 总伤害高
    let best = this.chars[0];
    for (const c of this.chars) {
      if (c.kills !== best.kills) {
        if (c.kills > best.kills) best = c;
      } else if (c.deaths !== best.deaths) {
        if (c.deaths < best.deaths) best = c;
      } else if (c.damage > best.damage) {
        best = c;
      }
    }
    return best.id;
  }

  private endMatch(winnerOverride: string | null): void {
    if (this.phase !== 'live') return;
    this.phase = 'end';
    this.endT = 0;
    this.winnerId = winnerOverride ?? this.computeWinnerId();
    this.endTitle = winnerOverride ? '绝杀！' : '时间到！';
    this.timeLeft = 0;
    audio.stopHeartbeat();
    if (this.winnerId === this.player.id) audio.playVictory();
    else audio.playDefeat();
    this.emit({ type: 'timeUp', title: this.endTitle });
  }

  private finishMatch(): void {
    this.finishedEmitted = true;
    this.phase = 'done';
    const entries: MatchResultEntry[] = this.chars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isPlayer: c.isPlayer,
      kills: c.kills,
      deaths: c.deaths,
      damage: Math.round(c.damage),
      streakBest: c.streakBest,
    }));
    const results: MatchResults = {
      entries,
      winnerId: this.winnerId ?? this.computeWinnerId(),
      playerId: this.player.id,
      durationS: Math.round(this.matchTime),
      overtime: this.overtime,
      endedAt: Date.now(),
    };
    this.emit({ type: 'finished', results });
  }

  /* ---------------------------------------------------------------- */
  /* 渲染                                                              */
  /* ---------------------------------------------------------------- */

  private render(): void {
    const rs = this.rs;
    // 震动（trauma² × 14px + 0.6°）
    if (this.settings.shake && this.trauma > 0) {
      const amp = this.trauma * this.trauma * 14;
      rs.shakeX = (Math.random() * 2 - 1) * amp;
      rs.shakeY = (Math.random() * 2 - 1) * amp;
      rs.shakeRot = ((Math.random() * 2 - 1) * this.trauma * this.trauma * 0.6 * Math.PI) / 180;
    } else {
      rs.shakeX = 0;
      rs.shakeY = 0;
      rs.shakeRot = 0;
    }
    rs.camX = this.camX;
    rs.camY = this.camY;
    rs.zoom = this.zoom;
    rs.mouseX = this.input.mouseX;
    rs.mouseY = this.input.mouseY;
    rs.now = this.now;
    rs.endBubbles = this.phase === 'end';
    rs.winnerId = this.winnerId;
    rs.showDamageNumbers = this.settings.damageNumbers;
    this.renderer.draw(rs);
  }

  /* ---------------------------------------------------------------- */
  /* 公共 API                                                          */
  /* ---------------------------------------------------------------- */

  togglePause(): void {
    if (this.phase !== 'live' || this.destroyed) return;
    this.paused = !this.paused;
    if (this.paused) audio.stopHeartbeat();
    this.emit({ type: 'paused', paused: this.paused });
  }

  resume(): void {
    if (this.paused) this.togglePause();
  }

  isPaused(): boolean {
    return this.paused;
  }

  applySettings(s: ArenaSettings): void {
    this.settings = s;
  }

  private distToPlayer2(c: Character): number {
    return dist2(c.x, c.y, this.player.x, this.player.y);
  }

  getHud(): HudSnapshot {
    if (!this.player) {
      return {
        phase: this.phase,
        paused: false,
        timeLeftS: MATCH_DURATION_S,
        overtime: false,
        lowTime: false,
        hp: PLAYER_HP,
        shield: 0,
        alive: true,
        respawnT: 0,
        invincibleT: 0,
        streak: 0,
        kills: 0,
        weapons: WEAPON_ORDER.map((id, i) => ({
          id,
          owned: i === 0,
          mag: WEAPONS[id].magazine,
          reserve: i === 0 ? Infinity : 0,
          current: i === 0,
          reloading: false,
          reloadFrac: 0,
        })),
        board: [],
        killerName: '',
        killerWeapon: 'pistol',
      };
    }
    const p = this.player;
    const board: HudRow[] = this.chars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      kills: c.kills,
      deaths: c.deaths,
      isPlayer: c.isPlayer,
    }));
    board.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    return {
      phase: this.phase,
      paused: this.paused,
      timeLeftS: Math.max(0, this.timeLeft),
      overtime: this.overtime,
      lowTime: !this.overtime && this.phase === 'live' && this.timeLeft <= LOW_TIME_WARNING_S,
      hp: Math.max(0, Math.ceil(p.hp)),
      shield: Math.max(0, Math.ceil(p.shield)),
      alive: p.alive,
      respawnT: Math.max(0, p.respawnT),
      invincibleT: p.invincibleT,
      streak: p.streak,
      kills: p.kills,
      weapons: WEAPON_ORDER.map((id, i) => ({
        id,
        owned: p.slots[i].owned,
        mag: p.slots[i].mag,
        reserve: p.slots[i].reserve,
        current: p.slot === i,
        reloading: p.slot === i && p.reloadT > 0,
        reloadFrac: p.slot === i && p.reloadTotal > 0 ? 1 - p.reloadT / p.reloadTotal : 0,
      })),
      board,
      killerName: p.lastKillerName,
      killerWeapon: p.lastKillerWeapon,
    };
  }
}
