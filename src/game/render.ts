/**
 * Canvas 渲染器（game.md §3 §5 §6 §7 §9）：
 * 离屏预渲染地板/围栏/道具底座（2400×1600 一次性）；掩体/角色按 y 排序（伪 2.5D）；
 * 子弹/粒子/飘字/准星逐帧绘制；视锥裁剪视口 ±100u。
 */

import { COLORS, WEAPONS, ITEMS, WORLD_WIDTH, WORLD_HEIGHT, PLAYER_HP, SHIELD_MAX } from './constants';
import type { WeaponId } from './constants';
import type { Character, Pad, Bullet, Particle, DamageNumber, Decal } from './entities';
import { COVERS, BUSHES, SPAWN_POINTS, PADS, FENCE } from './world';
import type { Cover } from './world';

export const FONT_NUM = 'Bungee, "Noto Sans SC", sans-serif';
export const FONT_BODY = '"Noto Sans SC", sans-serif';

const INK = COLORS.ink;
/** 逻辑视口 1600×1000（16:10） */
export const VIEW_W = 1600;
export const VIEW_H = 1000;

export interface CrosshairState {
  /** 当前散布（度）→ 准星张合 */
  spreadDeg: number;
  hoverEnemy: boolean;
  /** 命中标记剩余秒 */
  hitT: number;
  hitKill: boolean;
  visible: boolean;
}

export interface RenderState {
  chars: Character[];
  pads: Pad[];
  bullets: Bullet[];
  particles: Particle[];
  damageNumbers: DamageNumber[];
  decals: Decal[];
  camX: number;
  camY: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
  shakeRot: number;
  mouseX: number;
  mouseY: number;
  crosshair: CrosshairState;
  now: number;
  playerId: string;
  /** 比赛结束阶段：角色头顶表情气泡 */
  endBubbles: boolean;
  winnerId: string | null;
  showDamageNumbers: boolean;
}

/** 确定性伪随机（地板点缀种子固定） */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function roundRectPath(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

const GUN_LEN: Record<WeaponId, number> = { pistol: 26, shotgun: 34, rifle: 36, sniper: 40 };

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  cw = 0;
  ch = 0;
  /** world → css px 比例（未含 zoom） */
  scale = 1;

  private floorCanvas: HTMLCanvasElement | null = null;
  private coverSprites: Partial<Record<string, HTMLCanvasElement>> = {};
  private glowSprites: Partial<Record<string, HTMLCanvasElement>> = {};
  private starPath: Path2D;
  /** y 排序 scratch（复用，避免逐帧分配） */
  private sortBuf: { y: number; kind: number; idx: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    // 四瓣星形路径（单位尺寸，供火花/枪口/星星）
    const p = new Path2D();
    const points = 4;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? 1 : 0.42;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
    this.starPath = p;
    this.resize();
  }

  resize(): void {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = cw;
    this.ch = ch;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.scale = Math.min(cw / VIEW_W, ch / VIEW_H);
  }

  /** 屏幕(css px) → 世界坐标 */
  screenToWorld(
    sx: number,
    sy: number,
    camX: number,
    camY: number,
    zoom: number,
    out: { x: number; y: number },
  ): void {
    const s = this.scale * zoom;
    out.x = camX + (sx - this.cw / 2) / s;
    out.y = camY + (sy - this.ch / 2) / s;
  }

  /* ---------------------------------------------------------------- */
  /* 离屏预渲染                                                        */
  /* ---------------------------------------------------------------- */

  prerender(): void {
    this.renderFloor();
    this.renderCoverSprites();
    this.renderGlowSprites();
  }

  private makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return [c, c.getContext('2d')!];
  }

  private renderFloor(): void {
    const [cv, g] = this.makeCanvas(WORLD_WIDTH, WORLD_HEIGHT);
    g.fillStyle = COLORS.floorBase;
    g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const tile = 64;
    for (let ty = 0; ty < WORLD_HEIGHT / tile; ty++) {
      for (let tx = 0; tx < WORLD_WIDTH / tile; tx++) {
        g.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        g.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    // 中央圆环（白，r220）
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx, cy, 220, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath();
    g.arc(cx, cy, 26, 0, Math.PI * 2);
    g.fill();
    // 四角装饰条纹（同心弧）
    const corners: [number, number][] = [
      [FENCE, FENCE],
      [WORLD_WIDTH - FENCE, FENCE],
      [FENCE, WORLD_HEIGHT - FENCE],
      [WORLD_WIDTH - FENCE, WORLD_HEIGHT - FENCE],
    ];
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.lineWidth = 5;
    for (const [ccx, ccy] of corners) {
      for (const r of [80, 130, 180]) {
        g.beginPath();
        g.arc(ccx, ccy, r, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // 随机点缀小花/石斑（种子固定）
    const rnd = mulberry32(20240817);
    for (let i = 0; i < 80; i++) {
      const x = FENCE + rnd() * (WORLD_WIDTH - FENCE * 2);
      const y = FENCE + rnd() * (WORLD_HEIGHT - FENCE * 2);
      if (rnd() < 0.5) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let p = 0; p < 4; p++) {
          const a = (p / 4) * Math.PI * 2 + rnd();
          g.beginPath();
          g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = 'rgba(255,200,49,0.55)';
        g.beginPath();
        g.arc(x, y, 2.6, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = 'rgba(20,18,46,0.08)';
        g.beginPath();
        g.ellipse(x, y, 5 + rnd() * 5, 3.5 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 出生点虚线白圈（r40）
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    for (const [sx, sy] of SPAWN_POINTS) {
      g.beginPath();
      g.arc(sx, sy, 40, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    // 道具底座（r40：ink 20% + 语义色 2px 虚线）
    for (const pad of PADS) {
      g.fillStyle = 'rgba(20,18,46,0.20)';
      g.beginPath();
      g.arc(pad.x, pad.y, 40, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = ITEMS[pad.type].color;
      g.globalAlpha = 0.7;
      g.lineWidth = 2;
      g.setLineDash([8, 6]);
      g.beginPath();
      g.arc(pad.x, pad.y, 40, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }
    this.drawFence(g);
    this.floorCanvas = cv;
  }

  private drawFence(g: CanvasRenderingContext2D): void {
    const W = WORLD_WIDTH;
    const H = WORLD_HEIGHT;
    const t = FENCE;
    g.fillStyle = '#C98A5B';
    g.fillRect(0, 0, W, t);
    g.fillRect(0, H - t, W, t);
    g.fillRect(0, 0, t, H);
    g.fillRect(W - t, 0, t, H);
    g.strokeStyle = 'rgba(20,18,46,0.35)';
    g.lineWidth = 2;
    for (let x = 0; x <= W; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, t);
      g.moveTo(x, H - t);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y <= H; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(t, y);
      g.moveTo(W - t, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, W - 3, H - 3);
    g.strokeRect(t, t, W - t * 2, H - t * 2);
    // 角柱：黄黑警示条纹
    const post = 44;
    for (const [px, py] of [
      [0, 0],
      [W - post, 0],
      [0, H - post],
      [W - post, H - post],
    ] as [number, number][]) {
      g.save();
      g.beginPath();
      g.rect(px, py, post, post);
      g.clip();
      g.fillStyle = COLORS.yel;
      g.fillRect(px, py, post, post);
      g.fillStyle = INK;
      for (let i = -2; i < 6; i++) {
        g.save();
        g.translate(px + i * 16, py);
        g.rotate(Math.PI / 4);
        g.fillRect(0, -post, 8, post * 3);
        g.restore();
      }
      g.restore();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.strokeRect(px + 1.5, py + 1.5, post - 3, post - 3);
    }
  }

  private renderCoverSprites(): void {
    // 木箱 96×96（+12u 底面）
    {
      const [cv, g] = this.makeCanvas(108, 120);
      g.translate(6, 6);
      g.fillStyle = '#8A5A33';
      g.fillRect(0, 92, 96, 12);
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.strokeRect(0, 92, 96, 16);
      g.fillStyle = '#C98A5B';
      g.fillRect(0, 0, 96, 96);
      g.strokeRect(1.5, 1.5, 93, 93);
      g.fillStyle = '#B0793F';
      g.fillRect(0, 42, 96, 12);
      g.fillRect(42, 0, 12, 96);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(4, 4, 88, 6);
      this.coverSprites.crate = cv;
    }
    // 石墙（横）240×48
    {
      const [cv, g] = this.makeCanvas(252, 72);
      g.translate(6, 6);
      g.fillStyle = '#6A72A3';
      g.fillRect(0, 44, 240, 12);
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.strokeRect(0, 44, 240, 12);
      g.fillStyle = '#8E97C9';
      g.fillRect(0, 0, 240, 48);
      g.strokeRect(1.5, 1.5, 237, 45);
      g.strokeStyle = 'rgba(20,18,46,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 24);
      g.lineTo(240, 24);
      g.stroke();
      for (let x = 40; x < 240; x += 40) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, 24);
        g.moveTo(x - 20, 24);
        g.lineTo(x - 20, 48);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(4, 4, 232, 5);
      this.coverSprites.wallH = cv;
    }
    // 石墙（竖）48×160
    {
      const [cv, g] = this.makeCanvas(60, 172);
      g.translate(6, 6);
      g.fillStyle = '#6A72A3';
      g.fillRect(0, 156, 48, 12);
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.strokeRect(0, 156, 48, 12);
      g.fillStyle = '#8E97C9';
      g.fillRect(0, 0, 48, 160);
      g.strokeRect(1.5, 1.5, 45, 157);
      g.strokeStyle = 'rgba(20,18,46,0.35)';
      g.lineWidth = 2;
      for (let y = 40; y < 160; y += 40) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(48, y);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(24, 0);
      g.lineTo(24, 40);
      g.moveTo(24, 80);
      g.lineTo(24, 120);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(4, 4, 40, 5);
      this.coverSprites.wallV = cv;
    }
    // 轮胎堆 r56
    {
      const [cv, g] = this.makeCanvas(124, 128);
      g.translate(62, 60);
      g.fillStyle = 'rgba(20,18,46,0.30)';
      g.beginPath();
      g.ellipse(0, 52, 54, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3A3F55';
      g.beginPath();
      g.arc(0, 0, 56, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(0, 0, 40, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#2B2F45';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 0, 26, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#4A5068';
      g.beginPath();
      g.arc(0, 0, 16, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2.5;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * 48, Math.sin(a) * 48);
        g.lineTo(Math.cos(a) * 54, Math.sin(a) * 54);
        g.stroke();
      }
      this.coverSprites.tire = cv;
    }
  }

  private renderGlowSprites(): void {
    for (const w of Object.values(WEAPONS)) {
      const [cv, g] = this.makeCanvas(32, 32);
      const grad = g.createRadialGradient(16, 16, 1, 16, 16, 16);
      grad.addColorStop(0, w.color);
      grad.addColorStop(0.45, w.color + 'AA');
      grad.addColorStop(1, w.color + '00');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      this.glowSprites[w.id] = cv;
    }
  }

  /* ---------------------------------------------------------------- */
  /* 帧绘制                                                            */
  /* ---------------------------------------------------------------- */

  draw(s: RenderState): void {
    const g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // 界外暗化（letterbox）
    g.fillStyle = COLORS.void;
    g.fillRect(0, 0, this.cw, this.ch);

    const zoom = s.zoom;
    const viewW = VIEW_W / zoom;
    const viewH = VIEW_H / zoom;

    g.save();
    g.translate(this.cw / 2 + s.shakeX, this.ch / 2 + s.shakeY);
    if (s.shakeRot !== 0) g.rotate(s.shakeRot);
    g.scale(this.scale * zoom, this.scale * zoom);
    g.translate(-s.camX, -s.camY);

    // 视锥范围（±100u）
    const vx0 = s.camX - viewW / 2 - 100;
    const vx1 = s.camX + viewW / 2 + 100;
    const vy0 = s.camY - viewH / 2 - 100;
    const vy1 = s.camY + viewH / 2 + 100;

    // 1. 地板（静态离屏）
    if (this.floorCanvas) g.drawImage(this.floorCanvas, 0, 0);

    // 2. 道具台（呼吸光 / 道具 / 进度环）
    this.drawPads(g, s);

    // 3. 掩体 + 角色（y 排序伪 2.5D）+ 枪口火光
    this.drawWorldEntities(g, s, vx0, vx1, vy0, vy1);

    // 4. 子弹
    this.drawBullets(g, s, vx0, vx1, vy0, vy1);

    // 5. 粒子 / 凹痕 / 飘字
    this.drawParticles(g, s, vx0, vx1, vy0, vy1);
    this.drawDamageNumbers(g, s, vx0, vx1, vy0, vy1);

    g.restore();

    // 6. 准星（屏幕空间，顶层）
    this.drawCrosshair(g, s);
  }

  private drawPads(g: CanvasRenderingContext2D, s: RenderState): void {
    for (let i = 0; i < s.pads.length; i++) {
      const pad = s.pads[i];
      const color = ITEMS[pad.type].color;
      // 呼吸光圈（1.6s 循环错相）
      const breathe = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(s.now * ((Math.PI * 2) / 1.6) + i * 1.7));
      g.fillStyle = color;
      g.globalAlpha = breathe * 0.25;
      g.beginPath();
      g.arc(pad.x, pad.y, 44, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;

      if (pad.present) {
        const floatY = Math.sin(s.now * ((Math.PI * 2) / 1.4) + pad.phase) * 4;
        const scaleSync = 1 - floatY / 40;
        g.fillStyle = 'rgba(20,18,46,0.25)';
        g.beginPath();
        g.ellipse(pad.x, pad.y + 18, 16 * scaleSync, 6 * scaleSync, 0, 0, Math.PI * 2);
        g.fill();
        const popScale = pad.popT > 0 ? easeOutBack(Math.max(0, 1 - pad.popT / 0.3)) : 1;
        g.save();
        g.translate(pad.x, pad.y + floatY);
        g.scale(popScale, popScale);
        if (pad.type === 'medkit') this.drawMedkit(g);
        else if (pad.type === 'weaponbox') this.drawWeaponbox(g, s.now);
        else this.drawShieldItem(g, s.now);
        g.restore();
      } else {
        // 刷新进度环（顺时针填充）
        const frac = 1 - pad.timer / pad.total;
        g.strokeStyle = color;
        g.globalAlpha = 0.85;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(pad.x, pad.y, 30, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  private drawMedkit(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#FFFFFF';
    g.strokeStyle = COLORS.grn;
    g.lineWidth = 3;
    roundRectPath(g, -12, -12, 24, 24, 6);
    g.fill();
    g.stroke();
    g.fillStyle = COLORS.red;
    g.fillRect(-3, -8, 6, 16);
    g.fillRect(-8, -3, 16, 6);
  }

  private drawWeaponbox(g: CanvasRenderingContext2D, now: number): void {
    g.fillStyle = COLORS.pur;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    roundRectPath(g, -13, -13, 26, 26, 5);
    g.fill();
    g.stroke();
    g.fillStyle = COLORS.yel;
    g.save();
    g.scale(8, 8);
    g.fill(this.starPath);
    g.restore();
    // 循环光泽扫过
    const sweep = ((now * 0.8) % 1.6) * 52 - 26;
    g.save();
    roundRectPath(g, -13, -13, 26, 26, 5);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.save();
    g.rotate(Math.PI / 6);
    g.fillRect(sweep - 4, -20, 7, 40);
    g.restore();
    g.restore();
  }

  private drawShieldItem(g: CanvasRenderingContext2D, now: number): void {
    g.fillStyle = COLORS.blu;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 13;
      const y = Math.sin(a) * 13;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.stroke();
    // 白色星芒
    g.fillStyle = '#FFFFFF';
    g.save();
    g.rotate(now * 1.5);
    g.scale(6, 6);
    g.fill(this.starPath);
    g.restore();
  }

  private drawWorldEntities(
    g: CanvasRenderingContext2D,
    s: RenderState,
    vx0: number,
    vx1: number,
    vy0: number,
    vy1: number,
  ): void {
    // 草丛（视口内才更新摆动，2.5s ±2°）
    for (let i = 0; i < BUSHES.length; i++) {
      const b = BUSHES[i];
      if (b.cx < vx0 || b.cx > vx1 || b.cy < vy0 || b.cy > vy1) continue;
      const sway = Math.sin(s.now * ((Math.PI * 2) / 2.5) + i * 1.3) * ((2 * Math.PI) / 180);
      g.save();
      g.translate(b.cx, b.cy);
      g.rotate(sway);
      g.fillStyle = '#4CAF7D';
      g.strokeStyle = '#2E7D57';
      g.lineWidth = 3;
      roundRectPath(g, -60, -52, 120, 104, 28);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (const [lx, ly] of [
        [-26, -18],
        [18, -26],
        [30, 12],
        [-14, 20],
      ] as [number, number][]) {
        g.beginPath();
        g.ellipse(lx, ly, 14, 8, lx * 0.05, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // 角色阴影预通道（压在一切实体之下）
    for (const c of s.chars) {
      if (!c.alive && c.deadT >= 0.25) continue;
      if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      const ds = !c.alive ? 1 - c.deadT / 0.25 : 1;
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.ellipse(c.x, c.y + 14, 18 * ds, 6 * ds, 0, 0, Math.PI * 2);
      g.fill();
    }

    // y 排序：掩体 + 角色
    const buf = this.sortBuf;
    buf.length = 0;
    for (let i = 0; i < COVERS.length; i++) {
      const c = COVERS[i];
      const by = c.kind === 'tire' ? c.cy + c.r : c.y + c.h;
      const cx0 = c.kind === 'tire' ? c.cx - c.r : c.x;
      const cx1 = c.kind === 'tire' ? c.cx + c.r : c.x + c.w;
      const cy0 = c.kind === 'tire' ? c.cy - c.r : c.y;
      if (cx1 < vx0 || cx0 > vx1 || by < vy0 || cy0 > vy1) continue;
      buf.push({ y: by, kind: 0, idx: i });
    }
    for (let i = 0; i < s.chars.length; i++) {
      const c = s.chars[i];
      if (!c.alive && c.deadT >= 0.25) continue;
      if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      buf.push({ y: c.y + 18, kind: 1, idx: i });
    }
    buf.sort((a, b) => a.y - b.y);

    for (const item of buf) {
      if (item.kind === 0) this.drawCover(g, COVERS[item.idx]);
      else this.drawCharacter(g, s.chars[item.idx], s);
    }

    // 枪口火光（实体之后）：星形 4 瓣黄色闪光
    for (const c of s.chars) {
      if (!c.alive || c.muzzleT <= 0) continue;
      if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      const gunLen = GUN_LEN[c.slots ? (['pistol', 'shotgun', 'rifle', 'sniper'] as WeaponId[])[c.slot] : 'pistol'];
      const mx = c.x + Math.cos(c.aim) * (c.radius + gunLen + 4);
      const my = c.y + Math.sin(c.aim) * (c.radius + gunLen + 4);
      const alpha = c.muzzleT / 0.06;
      g.save();
      g.translate(mx, my);
      g.rotate(c.muzzleRot);
      g.globalAlpha = alpha;
      g.fillStyle = COLORS.yel;
      g.save();
      g.scale(14, 14);
      g.fill(this.starPath);
      g.restore();
      g.fillStyle = '#FFF6D8';
      g.save();
      g.scale(6, 6);
      g.fill(this.starPath);
      g.restore();
      g.globalAlpha = 1;
      g.restore();
    }
  }

  private drawCover(g: CanvasRenderingContext2D, c: Cover): void {
    if (c.kind === 'tire') {
      g.drawImage(this.coverSprites.tire!, c.cx - 62, c.cy - 60);
    } else if (c.kind === 'crate') {
      g.drawImage(this.coverSprites.crate!, c.x - 6, c.y - 6);
    } else if (c.kind === 'wallH') {
      g.drawImage(this.coverSprites.wallH!, c.x - 6, c.y - 6);
    } else {
      g.drawImage(this.coverSprites.wallV!, c.x - 6, c.y - 6);
    }
  }

  private drawCharacter(g: CanvasRenderingContext2D, c: Character, s: RenderState): void {
    const isPlayer = c.id === s.playerId;
    const wid = (['pistol', 'shotgun', 'rifle', 'sniper'] as WeaponId[])[c.slot];
    const w = WEAPONS[wid];

    // 玩家：脚下虚线圈 + 瞄准射线
    if (isPlayer && c.alive) {
      g.strokeStyle = 'rgba(255,255,255,0.65)';
      g.lineWidth = 2;
      g.setLineDash([6, 6]);
      g.beginPath();
      g.arc(c.x, c.y, 22, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(c.x + Math.cos(c.aim) * 26, c.y + Math.sin(c.aim) * 26);
      g.lineTo(c.x + Math.cos(c.aim) * 106, c.y + Math.sin(c.aim) * 106);
      g.stroke();
    }

    // 神枪阿亮瞄准线（20% 透明，仅它看见玩家时——危险提示）
    if (
      c.personality === 'sniper' &&
      c.alive &&
      c.brain &&
      c.brain.targetVisible &&
      c.brain.targetId === s.playerId
    ) {
      g.strokeStyle = 'rgba(155,92,255,0.2)';
      g.lineWidth = 3;
      g.setLineDash([12, 8]);
      g.beginPath();
      g.moveTo(c.x, c.y);
      g.lineTo(c.x + Math.cos(c.aim) * 800, c.y + Math.sin(c.aim) * 800);
      g.stroke();
      g.setLineDash([]);
    }

    // 死亡缩放 1→1.2→0（250ms）；出生 scale 0→1 ease-bounce
    let scale = 1;
    let alpha = 1;
    if (!c.alive) {
      const t = Math.min(c.deadT / 0.25, 1);
      scale = t < 0.5 ? 1 + 0.4 * t : 1.2 * (1 - (t - 0.5) / 0.5);
      alpha = 1 - t * 0.6;
    } else if (c.spawnT > 0) {
      scale = easeOutBack(Math.max(0, 1 - c.spawnT / 0.3));
    }
    // 果冻挤压（移动 8Hz：scaleY 1↔0.94）
    let sx = 1;
    let sy = 1;
    if (c.alive && c.moving) {
      const j = Math.abs(Math.sin(c.jellyPhase));
      sy = 1 - 0.06 * j;
      sx = 1 + 0.05 * j;
    }
    // 铁皮蛋换弹跺脚（scaleY 0.9 循环）
    if (c.alive && c.personality === 'berserker' && c.reloadT > 0) {
      sy *= 0.9 + 0.1 * Math.abs(Math.sin(s.now * 18));
    }
    // 待机呼吸（静止 2s 后 y ±2u / 1.8s）
    let idleY = 0;
    if (c.alive && c.idleT > 2) {
      idleY = Math.sin(s.now * ((Math.PI * 2) / 1.8)) * 2;
    }
    const kx = c.knockX;
    const ky = c.knockY;
    // 跑跑姜前倾 5°（以位移前倾近似）
    let leanX = 0;
    let leanY = 0;
    if (c.alive && c.personality === 'roamer' && c.moving) {
      const sp = Math.hypot(c.vx, c.vy) || 1;
      leanX = (c.vx / sp) * 3;
      leanY = (c.vy / sp) * 3;
    }

    g.save();
    g.translate(c.x + kx + leanX, c.y + ky + leanY + idleY);
    g.scale(scale * sx, scale * sy);
    g.globalAlpha = alpha;

    // 无敌泡泡（r26 blu 0.35 + 描边，1↔1.06 呼吸）
    if (c.alive && c.invincibleT > 0) {
      const breathe = 1 + 0.06 * Math.sin(s.now * ((Math.PI * 2) / 0.8));
      g.save();
      g.scale(breathe, breathe);
      g.fillStyle = 'rgba(62,166,255,0.28)';
      g.beginPath();
      g.arc(0, 0, 26, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(62,166,255,0.8)';
      g.lineWidth = 2;
      g.stroke();
      g.restore();
    }

    // 身体
    g.fillStyle = c.color;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 18, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // 背脊弧（深一档，aim 反方向 ±60°）
    g.strokeStyle = c.colorDark;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, 0, 13, c.aim + Math.PI - 1.05, c.aim + Math.PI + 1.05);
    g.stroke();
    // 眼睛（朝瞄准方向）
    const ex = Math.cos(c.aim);
    const ey = Math.sin(c.aim);
    const px = -ey;
    const py = ex;
    for (const side of [-1, 1]) {
      const cxp = ex * 7 + px * 6.5 * side;
      const cyp = ey * 7 + py * 6.5 * side;
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(cxp, cyp, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = INK;
      g.beginPath();
      g.arc(cxp + ex * 1.6, cyp + ey * 1.6, 2, 0, Math.PI * 2);
      g.fill();
    }
    // 受击白闪（80ms）
    if (c.hitFlashT > 0) {
      g.fillStyle = `rgba(255,255,255,${(c.hitFlashT / 0.08) * 0.7})`;
      g.beginPath();
      g.arc(0, 0, 18, 0, Math.PI * 2);
      g.fill();
    }

    // 武器（换弹摆动 / 切枪下甩 / 后坐）
    if (c.alive) {
      const gunLen = GUN_LEN[wid];
      let gunAngle = c.aim;
      let gunDrop = 0;
      if (c.reloadT > 0 && c.reloadTotal > 0) {
        const p = 1 - c.reloadT / c.reloadTotal;
        gunAngle += Math.sin(p * Math.PI * 2) * 0.5;
        gunDrop = Math.sin(p * Math.PI) * 4;
      }
      if (c.switchT > 0) {
        gunAngle += Math.sin((c.switchT / 0.25) * Math.PI) * 0.9;
      }
      const recoilMax = wid === 'shotgun' || wid === 'sniper' ? 12 : 6;
      const recoil = c.recoilT > 0 ? (c.recoilT / 0.08) * recoilMax : 0;
      g.save();
      g.rotate(gunAngle);
      g.translate(-recoil, gunDrop);
      const gunW = wid === 'shotgun' ? 10 : wid === 'sniper' ? 6 : 8;
      g.fillStyle = w.color;
      g.strokeStyle = INK;
      g.lineWidth = 2.5;
      roundRectPath(g, 8, -gunW / 2, gunLen, gunW, 3);
      g.fill();
      g.stroke();
      g.fillStyle = w.colorDark;
      g.fillRect(8 + gunLen - 2, -gunW / 2 - 1, 7, gunW + 2);
      g.strokeRect(8 + gunLen - 2, -gunW / 2 - 1, 7, gunW + 2);
      // 换弹：弹匣分离小动画
      if (c.reloadT > 0 && c.reloadTotal > 0) {
        const p = 1 - c.reloadT / c.reloadTotal;
        const magY = 6 + Math.sin(p * Math.PI) * 10;
        g.fillStyle = w.colorDark;
        g.globalAlpha = 1 - Math.sin(p * Math.PI) * 0.4;
        g.fillRect(14, magY, 6, 8);
        g.globalAlpha = 1;
      }
      g.restore();
    }
    g.restore();

    // 头顶名牌 + 血条（不随果冻缩放）
    if (c.alive) {
      g.font = `700 12px ${FONT_BODY}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.strokeText(c.name, c.x, c.y - 34);
      g.fillStyle = isPlayer ? '#FFFFFF' : c.color;
      g.fillText(c.name, c.x, c.y - 34);
      // 血条 44×6
      const bw = 44;
      const bx = c.x - bw / 2;
      const by = c.y - 27;
      g.fillStyle = 'rgba(20,18,46,0.4)';
      roundRectPath(g, bx, by, bw, 6, 3);
      g.fill();
      const hpFrac = Math.max(0, c.hp / PLAYER_HP);
      const lowHp = hpFrac < 0.3;
      g.fillStyle = lowHp ? COLORS.red : COLORS.grn;
      if (lowHp) g.globalAlpha = 0.7 + 0.3 * Math.sin(s.now * 10);
      if (hpFrac > 0) {
        roundRectPath(g, bx + 1, by + 1, Math.max(2, (bw - 2) * hpFrac), 4, 2);
        g.fill();
      }
      g.globalAlpha = 1;
      // 护盾细条
      if (c.shield > 0) {
        g.fillStyle = COLORS.blu;
        roundRectPath(g, bx + 1, by - 5, Math.max(2, (bw - 2) * (c.shield / SHIELD_MAX)), 3, 1.5);
        g.fill();
      }
      // 比赛结束表情气泡（胜者 😎 其余 💦）
      if (s.endBubbles) {
        const isWinner = c.id === s.winnerId;
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(c.x + 20, c.y - 44, 13, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.font = '14px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(isWinner ? '😎' : '💦', c.x + 20, c.y - 43);
      }
    }
  }

  private drawBullets(
    g: CanvasRenderingContext2D,
    s: RenderState,
    vx0: number,
    vx1: number,
    vy0: number,
    vy1: number,
  ): void {
    for (const b of s.bullets) {
      if (!b.active) continue;
      if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) continue;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const nx = b.vx / sp;
      const ny = b.vy / sp;
      // 尾部 24u 渐隐拖尾（线宽 3→0 近似三段）
      g.strokeStyle = b.color;
      g.lineCap = 'round';
      g.globalAlpha = 0.16;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(b.x - nx * 24, b.y - ny * 24);
      g.lineTo(b.x - nx * 14, b.y - ny * 14);
      g.stroke();
      g.globalAlpha = 0.34;
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(b.x - nx * 14, b.y - ny * 14);
      g.lineTo(b.x - nx * 6, b.y - ny * 6);
      g.stroke();
      g.globalAlpha = 1;
      // 武器色光晕 + 白色弹体（r4）
      const glow = this.glowSprites[b.weapon];
      if (glow) g.drawImage(glow, b.x - 10, b.y - 10, 20, 20);
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(b.x, b.y, 4, 0, Math.PI * 2);
      g.fill();
    }
    g.lineCap = 'butt';
  }

  private drawParticles(
    g: CanvasRenderingContext2D,
    s: RenderState,
    vx0: number,
    vx1: number,
    vy0: number,
    vy1: number,
  ): void {
    // 凹痕（200ms 淡出）
    for (const d of s.decals) {
      if (!d.active) continue;
      const a = (1 - d.t / d.life) * 0.45;
      g.fillStyle = `rgba(20,18,46,${a})`;
      g.beginPath();
      g.arc(d.x, d.y, 3.2, 0, Math.PI * 2);
      g.fill();
    }
    for (const p of s.particles) {
      if (!p.active) continue;
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const frac = p.life / p.maxLife;
      if (p.kind === 0 || p.kind === 4) {
        // 星星火花（scale 1→0）
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.globalAlpha = Math.min(1, frac * 1.5);
        const sz = p.size * (0.4 + 0.6 * frac);
        g.scale(sz, sz);
        g.fillStyle = p.color;
        g.fill(this.starPath);
        g.restore();
      } else if (p.kind === 1) {
        // 尘雾
        g.globalAlpha = frac * 0.5;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size * (1.6 - frac * 0.6), 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      } else if (p.kind === 2) {
        // 冲击环（半径 8→40u）
        const t = 1 - frac;
        g.globalAlpha = frac * 0.8;
        g.strokeStyle = p.color;
        g.lineWidth = 3 * frac + 1;
        g.beginPath();
        g.arc(p.x, p.y, p.size + t * 32, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      } else {
        // 幽灵表情（×_× 圆脸）上飘淡出
        g.globalAlpha = frac;
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(p.x, p.y, 12, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.strokeStyle = INK;
        g.lineWidth = 1.8;
        for (const side of [-1, 1]) {
          const ex2 = p.x + side * 4.5;
          const ey2 = p.y - 2;
          g.beginPath();
          g.moveTo(ex2 - 2.2, ey2 - 2.2);
          g.lineTo(ex2 + 2.2, ey2 + 2.2);
          g.moveTo(ex2 + 2.2, ey2 - 2.2);
          g.lineTo(ex2 - 2.2, ey2 + 2.2);
          g.stroke();
        }
        g.beginPath();
        g.arc(p.x, p.y + 5, 2.5, 0, Math.PI);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  private drawDamageNumbers(
    g: CanvasRenderingContext2D,
    s: RenderState,
    vx0: number,
    vx1: number,
    vy0: number,
    vy1: number,
  ): void {
    for (const d of s.damageNumbers) {
      if (!d.active) continue;
      if (d.x < vx0 || d.x > vx1 || d.y < vy0 || d.y > vy1) continue;
      const t = d.t / d.life;
      const y = d.y - 48 * t;
      g.globalAlpha = 1 - t * t;
      g.font = `${d.size}px ${FONT_NUM}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 4;
      g.strokeStyle = INK;
      g.strokeText(d.text, d.x, y);
      g.fillStyle = d.color;
      g.fillText(d.text, d.x, y);
      g.globalAlpha = 1;
    }
  }

  private drawCrosshair(g: CanvasRenderingContext2D, s: RenderState): void {
    const ch = s.crosshair;
    if (!ch.visible) return;
    const x = s.mouseX;
    const y = s.mouseY;
    const gap = 6 + Math.min(12, ch.spreadDeg * 1.3);
    const arm = 10;
    const color = ch.hoverEnemy ? COLORS.red : '#FFFFFF';
    g.save();
    g.translate(x, y);
    g.lineCap = 'round';
    // ink 描边层 + 白色层
    for (const pass of [0, 1]) {
      g.strokeStyle = pass === 0 ? INK : color;
      g.lineWidth = pass === 0 ? 5 : 2.5;
      g.beginPath();
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as [number, number][]) {
        g.moveTo(dx * gap, dy * gap);
        g.lineTo(dx * (gap + arm), dy * (gap + arm));
      }
      g.stroke();
    }
    // 中心点
    g.fillStyle = color;
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, 2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // 命中 × 标记（150ms；击杀金色放大 1.6）
    if (ch.hitT > 0) {
      const a = Math.min(1, ch.hitT / 0.15);
      const sz = ch.hitKill ? 8 * 1.6 : 8;
      g.strokeStyle = ch.hitKill ? COLORS.yel : COLORS.red;
      g.globalAlpha = a;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-sz, -sz);
      g.lineTo(sz, sz);
      g.moveTo(sz, -sz);
      g.lineTo(-sz, sz);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.restore();
    g.lineCap = 'butt';
  }
}
