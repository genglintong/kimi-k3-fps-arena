/**
 * 武器派生指标（armory.md §3 §4）——全部由 src/game/constants.ts 的 WEAPONS 计算，
 * 禁止硬编码任何数值。design.md / game.md 改数，本页自动跟随。
 */

import { PLAYER_HP, WEAPONS, WEAPON_ORDER } from '@/game/constants';
import type { WeaponDef, WeaponId } from '@/game/constants';

/** 单发爆发伤害（霰弹 = 单颗伤害 × 弹丸数） */
export const burstDamage = (w: WeaponDef): number => w.damage * w.pellets;

/** 射速（发/秒） */
export const roundsPerSecond = (w: WeaponDef): number => 1000 / w.fireIntervalMs;

/** 理论 DPS = 单发爆发 × 射速（不计换弹） */
export const theoreticalDps = (w: WeaponDef): number => burstDamage(w) * roundsPerSecond(w);

/** 击杀满血玩家（PLAYER_HP）所需命中枪数（霰弹按全弹丸命中计） */
export const shotsToKill = (w: WeaponDef): number => Math.ceil(PLAYER_HP / burstDamage(w));

/** 换弹时间（秒，保留 1 位小数） */
export const reloadSeconds = (w: WeaponDef): number => w.reloadMs / 1000;

/** 获取方式：手枪出生自带且无限弹，其余来自武器箱 */
export const obtainMethod = (w: WeaponDef): string =>
  w.ammoReserve === Infinity ? '出生自带 · 无限弹' : '武器箱拾取';

const maxOf = (fn: (w: WeaponDef) => number): number =>
  Math.max(...WEAPON_ORDER.map((id) => fn(WEAPONS[id])));
const minOf = (fn: (w: WeaponDef) => number): number =>
  Math.min(...WEAPON_ORDER.map((id) => fn(WEAPONS[id])));

const MAX = {
  burst: maxOf(burstDamage),
  rps: maxOf(roundsPerSecond),
  range: maxOf((w) => w.range),
  magazine: maxOf((w) => w.magazine),
  reload: maxOf((w) => w.reloadMs),
};
const MIN_RELOAD = minOf((w) => w.reloadMs);

/* ------------------------------------------------------------------ */
/* 5 维能力条（0–100）：同一维度按 4 把武器的最大值归一化                  */
/* ------------------------------------------------------------------ */

export interface WeaponBars {
  damage: number;
  fireRate: number;
  range: number;
  magazine: number;
  ease: number;
}

export const BAR_DEFS: { key: keyof WeaponBars; label: string }[] = [
  { key: 'damage', label: '伤害' },
  { key: 'fireRate', label: '射速' },
  { key: 'range', label: '射程' },
  { key: 'magazine', label: '弹匣' },
  { key: 'ease', label: '上手度' },
];

export function weaponBars(w: WeaponDef): WeaponBars {
  const pct = (v: number, max: number) => Math.round((v / max) * 100);
  return {
    // 平方根曲线：狙击 75 爆发不至于把其他枪压成薄片
    damage: Math.round(Math.sqrt(burstDamage(w) / MAX.burst) * 100),
    fireRate: pct(roundsPerSecond(w), MAX.rps),
    range: pct(w.range, MAX.range),
    magazine: pct(w.magazine, MAX.magazine),
    // 上手度与换弹时长负相关（换弹越慢越难驾驭），映射到 15–100
    ease: Math.round(15 + (85 * (MAX.reload - w.reloadMs)) / (MAX.reload - MIN_RELOAD)),
  };
}

/* ------------------------------------------------------------------ */
/* 对比表行定义（armory.md §4）：每行给出取值 / 文案 / 最优判定            */
/* ------------------------------------------------------------------ */

export interface CompareRow {
  label: string;
  /** 单元格展示文案 */
  text: (w: WeaponDef) => string;
  /** 用于比较最优的数值 */
  score: (w: WeaponDef) => number;
  /** 最优 = 最大值还是最小值 */
  best: 'max' | 'min';
}

export const COMPARE_ROWS: CompareRow[] = [
  {
    label: '单发伤害',
    text: (w) => (w.pellets > 1 ? `${w.damage}×${w.pellets}` : `${w.damage}`),
    score: burstDamage,
    best: 'max',
  },
  {
    label: '射速（发/秒）',
    text: (w) => roundsPerSecond(w).toFixed(1),
    score: roundsPerSecond,
    best: 'max',
  },
  {
    label: '弹匣 / 备弹',
    text: (w) => `${w.magazine} / ${w.ammoReserve === Infinity ? '∞' : w.ammoReserve}`,
    score: (w) => w.magazine,
    best: 'max',
  },
  {
    label: '射程（u）',
    text: (w) => `${w.range}`,
    score: (w) => w.range,
    best: 'max',
  },
  {
    label: '换弹时间',
    text: (w) => `${reloadSeconds(w).toFixed(1)}s`,
    score: (w) => w.reloadMs,
    best: 'min',
  },
];

/** 每行的最优武器 */
export function bestWeaponFor(row: CompareRow): WeaponId {
  let best: WeaponId = WEAPON_ORDER[0];
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id];
    const b = WEAPONS[best];
    if (row.best === 'max' ? row.score(w) > row.score(b) : row.score(w) < row.score(b)) {
      best = id;
    }
  }
  return best;
}
