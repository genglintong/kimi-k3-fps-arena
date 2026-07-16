/**
 * 比赛结算数据层（/results 专用）
 * 数据源：localStorage 'gun-arena:match-results'（/play 在 END 时写入）。
 * 注：constants.STORAGE_KEYS 未定义该键且 src/game/* 不可改，故在此局部定义。
 * 纯逻辑，无 React 依赖；所有函数对脏数据容错，绝不抛异常。
 */

import {
  Crown,
  Flame,
  Handshake,
  HeartCrack,
  Shield,
  Skull,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PLAYER_COLOR } from '@/game/constants';

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export interface MatchEntry {
  id: string;
  name: string;
  color: string;
  isPlayer: boolean;
  kills: number;
  deaths: number;
  damage: number;
  streakBest: number;
}

export interface MatchResult {
  entries: MatchEntry[];
  winnerId: string;
  playerId: string;
  durationS: number;
  overtime: boolean;
  endedAt: number;
}

export interface RankedEntry extends MatchEntry {
  rank: number;
}

export const MATCH_RESULTS_KEY = 'gun-arena:match-results';

/* ------------------------------------------------------------------ */
/* 读取与校验                                                          */
/* ------------------------------------------------------------------ */

function toNonNegNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseEntry(raw: unknown): MatchEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== 'string' || typeof e.name !== 'string') return null;
  const kills = toNonNegNum(e.kills);
  const deaths = toNonNegNum(e.deaths);
  const damage = toNonNegNum(e.damage);
  const streakBest = toNonNegNum(e.streakBest);
  if (kills === null || deaths === null || damage === null || streakBest === null) return null;
  return {
    id: e.id,
    name: e.name,
    color: typeof e.color === 'string' && e.color ? e.color : PLAYER_COLOR,
    isPlayer: e.isPlayer === true,
    kills: Math.round(kills),
    deaths: Math.round(deaths),
    damage: Math.round(damage),
    streakBest: Math.round(streakBest),
  };
}

/** 读取并校验当局战绩；缺失/损坏时返回 null（页面展示空态） */
export function loadMatchResult(): MatchResult | null {
  try {
    const raw = localStorage.getItem(MATCH_RESULTS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<MatchResult> | null;
    if (!p || typeof p !== 'object' || !Array.isArray(p.entries) || p.entries.length === 0) {
      return null;
    }
    const entries: MatchEntry[] = [];
    for (const e of p.entries) {
      const parsed = parseEntry(e);
      if (!parsed) return null;
      entries.push(parsed);
    }
    // 玩家必须可定位（playerId 优先，isPlayer 兜底）
    const player =
      entries.find((e) => e.id === p.playerId) ?? entries.find((e) => e.isPlayer);
    if (!player) return null;
    if (!player.isPlayer) player.isPlayer = true;

    const durationS = toNonNegNum(p.durationS) ?? 180;
    const endedAt = toNonNegNum(p.endedAt) ?? Date.now();
    return {
      entries,
      winnerId: typeof p.winnerId === 'string' ? p.winnerId : '',
      playerId: player.id,
      durationS,
      overtime: p.overtime === true,
      endedAt,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 排名与派生数据                                                      */
/* ------------------------------------------------------------------ */

/** 胜利判定（design.md §11）：击杀多 → 死亡少 → 总伤害高 */
export function rankEntries(entries: MatchEntry[]): RankedEntry[] {
  return [...entries]
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.damage - a.damage)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function kdOf(e: MatchEntry): number {
  return e.deaths === 0 ? e.kills : e.kills / e.deaths;
}

/** 战况一句话评语池（results.md §2：按表现 6 条） */
export function pickVerdict(
  player: RankedEntry,
  isTopDamage: boolean,
  endedAt: number,
): string {
  if (player.rank === 1 && player.kills >= 8) return '全场最靓的仔';
  if (player.rank === 1) return '枪王本色，实至名归';
  if (player.streakBest >= 5) return '人形自走挂';
  if (player.deaths >= 8) return '敢死队队长';
  if (isTopDamage) return '移动炮台，火力拉满';
  if (player.kills === 0) return '和平主义者';
  const pool = ['手感火热，下局冲冠', '虽败犹荣，就差一步', '枪法渐长，继续加油'];
  return pool[Math.abs(Math.floor(endedAt)) % pool.length];
}

/* ------------------------------------------------------------------ */
/* 勋章（可由现有数据计算的 7 条规则，最多取 3 枚）                      */
/* ------------------------------------------------------------------ */

export interface Medal {
  id: string;
  name: string;
  desc: string;
  color: string;
  icon: LucideIcon;
  priority: number;
}

export function computeMedals(ranked: RankedEntry[], player: RankedEntry): Medal[] {
  const maxKills = Math.max(...ranked.map((e) => e.kills));
  const maxDamage = Math.max(...ranked.map((e) => e.damage));
  const medals: Medal[] = [];

  if (player.rank === 1) {
    medals.push({
      id: 'champion',
      name: '枪王',
      desc: '拿下全场第一，枪王之位坐稳了',
      color: '#FFC831',
      icon: Crown,
      priority: 100,
    });
  }
  if (player.kills > 0 && player.kills === maxKills) {
    medals.push({
      id: 'slayer',
      name: '杀人王',
      desc: `单场 ${player.kills} 杀，全场最多`,
      color: '#FF5A5F',
      icon: Skull,
      priority: 90,
    });
  }
  if (player.streakBest >= 5) {
    medals.push({
      id: 'streak',
      name: '连杀之王',
      desc: `最高 ${player.streakBest} 连杀，势不可挡`,
      color: '#FF8A3D',
      icon: Flame,
      priority: 85,
    });
  }
  if (player.damage > 0 && player.damage === maxDamage) {
    medals.push({
      id: 'artillery',
      name: '炮台',
      desc: `总伤害 ${player.damage}，全场最高输出`,
      color: '#9B5CFF',
      icon: Zap,
      priority: 80,
    });
  }
  if (player.deaths === 0) {
    medals.push({
      id: 'phoenix',
      name: '不死鸟',
      desc: '整局 0 死亡，命比钻石硬',
      color: '#3ED97E',
      icon: Shield,
      priority: 70,
    });
  }
  if (maxKills > 0 && player.kills <= maxKills / 2 && player.damage >= maxDamage * 0.6) {
    medals.push({
      id: 'support',
      name: '助攻型',
      desc: '伤害打满，人头却被别人捡走了',
      color: '#3EA6FF',
      icon: Handshake,
      priority: 50,
    });
  }
  if (player.deaths >= 8) {
    medals.push({
      id: 'daredevil',
      name: '敢死队',
      desc: `阵亡 ${player.deaths} 次仍冲锋不止`,
      color: '#FF6FB5',
      icon: HeartCrack,
      priority: 40,
    });
  }

  return medals.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* 分享文案                                                            */
/* ------------------------------------------------------------------ */

export function buildShareText(player: RankedEntry, total: number): string {
  const kd = kdOf(player).toFixed(1);
  if (player.rank === 1) {
    return `【枪火竞技场】我拿下了 #1！${player.kills} 杀 ${player.deaths} 死，K/D ${kd}，总伤害 ${player.damage}，你也来试试！`;
  }
  return `【枪火竞技场】本局排名 #${player.rank}/${total}：${player.kills} 杀 ${player.deaths} 死，K/D ${kd}，总伤害 ${player.damage}，下一局必雪耻！`;
}
