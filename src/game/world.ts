/**
 * 竞技场世界数据与几何（game.md §4 —— 坐标为唯一事实源，禁止改动）
 * 世界 2400×1600；掩体（木箱/石墙/轮胎）挡人挡子弹；草丛纯装饰。
 */

import { WORLD_WIDTH, WORLD_HEIGHT } from './constants';
import type { ItemType } from './constants';

/* ------------------------------------------------------------------ */
/* 掩体                                                                */
/* ------------------------------------------------------------------ */

export interface RectCover {
  kind: 'crate' | 'wallH' | 'wallV';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleCover {
  kind: 'tire';
  cx: number;
  cy: number;
  r: number;
}

export type Cover = RectCover | CircleCover;

/** 木箱 ×6（96×96，坐标为中心点） */
const CRATE_CENTERS: [number, number][] = [
  [480, 400],
  [1920, 400],
  [480, 1200],
  [1920, 1200],
  [1200, 300],
  [1200, 1300],
];

/** 石墙（横）×4：x,y,w,h */
const WALL_H_RECTS: [number, number, number, number][] = [
  [640, 720, 240, 48],
  [1520, 720, 240, 48],
  [640, 832, 240, 48],
  [1520, 832, 240, 48],
];

/** 石墙（竖）×2 */
const WALL_V_RECTS: [number, number, number, number][] = [
  [1176, 480, 48, 160],
  [1176, 960, 48, 160],
];

/** 轮胎堆 ×4（半径 56，中心点） */
const TIRES: [number, number][] = [
  [300, 800],
  [2100, 800],
  [900, 180],
  [1500, 1420],
];

export const COVERS: Cover[] = [
  ...CRATE_CENTERS.map(([cx, cy]): RectCover => ({ kind: 'crate', x: cx - 48, y: cy - 48, w: 96, h: 96 })),
  ...WALL_H_RECTS.map(([x, y, w, h]): RectCover => ({ kind: 'wallH', x, y, w, h })),
  ...WALL_V_RECTS.map(([x, y, w, h]): RectCover => ({ kind: 'wallV', x, y, w, h })),
  ...TIRES.map(([cx, cy]): CircleCover => ({ kind: 'tire', cx, cy, r: 56 })),
];

/** 草丛 ×4（120×120，纯装饰，可穿行、不挡子弹） */
export const BUSHES: { cx: number; cy: number; size: number }[] = [
  { cx: 600, cy: 560, size: 120 },
  { cx: 1800, cy: 560, size: 120 },
  { cx: 600, cy: 1040, size: 120 },
  { cx: 1800, cy: 1040, size: 120 },
];

/* ------------------------------------------------------------------ */
/* 功能点（game.md §4.3）                                              */
/* ------------------------------------------------------------------ */

export interface PadDef {
  type: ItemType;
  x: number;
  y: number;
}

export const PADS: PadDef[] = [
  { type: 'medkit', x: 240, y: 240 },
  { type: 'medkit', x: 2160, y: 240 },
  { type: 'medkit', x: 1200, y: 800 },
  { type: 'weaponbox', x: 240, y: 1360 },
  { type: 'weaponbox', x: 2160, y: 1360 },
  { type: 'weaponbox', x: 1200, y: 240 },
  { type: 'shield', x: 960, y: 800 },
  { type: 'shield', x: 1440, y: 800 },
];

export const SPAWN_POINTS: [number, number][] = [
  [160, 160],
  [2240, 160],
  [160, 1440],
  [2240, 1440],
  [1200, 120],
  [1200, 1480],
  [120, 800],
  [2280, 800],
];

/** 围栏厚度（视觉 32u，角色活动边界） */
export const FENCE = 32;

/** AI 巡逻路径点（出生点 + 道具台 + 中央与走廊中点） */
export const WAYPOINTS: [number, number][] = [
  ...SPAWN_POINTS,
  ...PADS.map((p): [number, number] => [p.x, p.y]),
  [1200, 800],
  [600, 800],
  [1800, 800],
  [1200, 560],
  [1200, 1040],
  [480, 800],
  [1920, 800],
];

/** 老六（camper）伏击点：掩体旁 */
export const AMBUSH_POINTS: [number, number][] = [
  [480, 500],
  [1920, 500],
  [480, 1100],
  [1920, 1100],
  [1080, 300],
  [1320, 1300],
  [640, 660],
  [1760, 940],
  [1116, 560],
  [1284, 1040],
];

/* ------------------------------------------------------------------ */
/* 几何工具                                                            */
/* ------------------------------------------------------------------ */

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy;
}

/**
 * 线段 vs 矩形（slab 法），返回最早命中 t∈[0,1]，未命中返回 Infinity。
 */
function segRectT(x0: number, y0: number, x1: number, y1: number, r: RectCover): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < r.x || x0 > r.x + r.w) return Infinity;
  } else {
    const inv = 1 / dx;
    let t1 = (r.x - x0) * inv;
    let t2 = (r.x + r.w - x0) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y0 < r.y || y0 > r.y + r.h) return Infinity;
  } else {
    const inv = 1 / dy;
    let t1 = (r.y - y0) * inv;
    let t2 = (r.y + r.h - y0) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

/** 线段 vs 圆，返回最早命中 t∈[0,1]，未命中 Infinity */
function segCircleT(
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
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}

/** 线段 vs 单个掩体 */
export function segCoverT(x0: number, y0: number, x1: number, y1: number, c: Cover): number {
  if (c.kind === 'tire') return segCircleT(x0, y0, x1, y1, c.cx, c.cy, c.r);
  return segRectT(x0, y0, x1, y1, c);
}

/**
 * 线段 vs 全部掩体，返回最早命中 t（无命中返回 Infinity）。
 * 用于子弹扫掠与 AI 视线判定。
 */
export function raycastCovers(x0: number, y0: number, x1: number, y1: number): number {
  let best = Infinity;
  for (let i = 0; i < COVERS.length; i++) {
    const t = segCoverT(x0, y0, x1, y1, COVERS[i]);
    if (t < best) best = t;
  }
  return best;
}

/** 两点间是否有掩体阻挡（AI 视线） */
export function hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
  return raycastCovers(x0, y0, x1, y1) === Infinity;
}

/**
 * 圆（角色）与世界的碰撞解算：直接修改 pos 引用对象。
 * 处理 13 个掩体 + 围栏边界。
 */
export function resolveCircleWorld(pos: { x: number; y: number }, r: number): void {
  for (let i = 0; i < COVERS.length; i++) {
    const c = COVERS[i];
    if (c.kind === 'tire') {
      const dx = pos.x - c.cx;
      const dy = pos.y - c.cy;
      const rr = c.r + r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos.x = c.cx + (dx / d) * rr;
        pos.y = c.cy + (dy / d) * rr;
      }
    } else {
      const nx = clamp(pos.x, c.x, c.x + c.w);
      const ny = clamp(pos.y, c.y, c.y + c.h);
      const dx = pos.x - nx;
      const dy = pos.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.y = ny + (dy / d) * r;
        } else {
          // 圆心在矩形内：沿最小穿透轴推出
          const pushL = pos.x - c.x + r;
          const pushR = c.x + c.w - pos.x + r;
          const pushU = pos.y - c.y + r;
          const pushD = c.y + c.h - pos.y + r;
          const min = Math.min(pushL, pushR, pushU, pushD);
          if (min === pushL) pos.x = c.x - r;
          else if (min === pushR) pos.x = c.x + c.w + r;
          else if (min === pushU) pos.y = c.y - r;
          else pos.y = c.y + c.h + r;
        }
      }
    }
  }
  pos.x = clamp(pos.x, FENCE + r, WORLD_WIDTH - FENCE - r);
  pos.y = clamp(pos.y, FENCE + r, WORLD_HEIGHT - FENCE - r);
}

/**
 * 选择重生点：优先距最近敌人 ≥ minDist 的随机点；无合格点时选「最远离最近敌人」的点。
 */
export function pickSpawnPoint(
  enemies: { x: number; y: number; alive: boolean }[],
  minDist: number,
): [number, number] {
  const candidates: [number, number][] = [];
  let bestPoint = SPAWN_POINTS[0];
  let bestScore = -1;
  for (const p of SPAWN_POINTS) {
    let nearest = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d2 = dist2(p[0], p[1], e.x, e.y);
      if (d2 < nearest) nearest = d2;
    }
    if (nearest >= minDist * minDist) candidates.push(p);
    if (nearest > bestScore) {
      bestScore = nearest;
      bestPoint = p;
    }
  }
  if (candidates.length === 0) return bestPoint;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
