/**
 * 实体定义与对象池（design.md §13 性能契约：子弹 200 / 粒子 400 / 飘字 32 / 凹痕 40）。
 * 所有池预分配，热循环零分配。
 */

import { WEAPONS, WEAPON_ORDER, PLAYER_HP, SHIELD_MAX } from './constants';
import type { WeaponId, BotPersonality, ItemType } from './constants';

/* ------------------------------------------------------------------ */
/* 角色                                                                */
/* ------------------------------------------------------------------ */

export interface WeaponSlot {
  owned: boolean;
  mag: number;
  reserve: number;
}

export type AiStateName = 'patrol' | 'seek' | 'chase' | 'attack' | 'flee';

export interface BotBrain {
  state: AiStateName;
  targetId: string | null;
  /** 目标当前可见（轮转刷新） */
  targetVisible: boolean;
  /** 目标最后被看到的游戏时刻（秒） */
  lastSeenAt: number;
  /** 目标首次被看到的时刻（反应时间用） */
  acquiredAt: number;
  waypointX: number;
  waypointY: number;
  /** 距下次换路径点的秒数 */
  repathT: number;
  strafePhase: number;
  strafePeriod: number;
  strafeDir: number;
  /** 目标道具台索引；-1 无 */
  seekPad: number;
  /** 撤退/脱战计时 */
  fleeT: number;
  /** 决策节流 */
  decideT: number;
  /** 当前帧期望移动方向（AI 输出，含巡逻 0.7 减速） */
  moveX: number;
  moveY: number;
  wantFire: boolean;
  aimX: number;
  aimY: number;
  /** 视线轮转帧偏移 */
  losOffset: number;
  /** camper 伏击点索引 */
  ambushIdx: number;
  /** 最近受击时刻（秒，FLEE 触发用） */
  lastHurtAt: number;
  /** 卡死检测 */
  lastX: number;
  lastY: number;
  stuckT: number;
  detourT: number;
  detourDir: number;
}

export function createBrain(losOffset: number): BotBrain {
  return {
    state: 'patrol',
    targetId: null,
    targetVisible: false,
    lastSeenAt: -999,
    acquiredAt: -999,
    waypointX: 0,
    waypointY: 0,
    repathT: 0,
    strafePhase: Math.random() * Math.PI * 2,
    strafePeriod: 1.2 + Math.random() * 0.8,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    seekPad: -1,
    fleeT: 0,
    decideT: Math.random() * 0.3,
    moveX: 0,
    moveY: 0,
    wantFire: false,
    aimX: 0,
    aimY: 0,
    losOffset,
    ambushIdx: -1,
    lastHurtAt: -999,
    lastX: 0,
    lastY: 0,
    stuckT: 0,
    detourT: 0,
    detourDir: 1,
  };
}

export interface Character {
  id: string;
  name: string;
  color: string;
  colorDark: string;
  isPlayer: boolean;
  personality: BotPersonality | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 瞄准角（弧度） */
  aim: number;
  radius: number;
  hp: number;
  shield: number;
  alive: boolean;
  /** 死亡后剩余重生秒数 */
  respawnT: number;
  /** 重生无敌剩余秒数 */
  invincibleT: number;
  kills: number;
  deaths: number;
  damage: number;
  streak: number;
  streakBest: number;
  slots: WeaponSlot[];
  /** 当前武器槽索引（WEAPON_ORDER 顺序） */
  slot: number;
  /** 距上次开火的秒数 */
  sinceShot: number;
  /** 换弹剩余秒数（0 = 未在换弹） */
  reloadT: number;
  reloadTotal: number;
  /** 切枪剩余秒数 */
  switchT: number;
  /** 步枪连射散布增长（度） */
  bloomDeg: number;
  /** 距上次扣扳机（步枪散布回落用） */
  sinceTrigger: number;
  /* ----- 表现层 ----- */
  hitFlashT: number;
  knockX: number;
  knockY: number;
  /** 出生弹入进度 */
  spawnT: number;
  /** 死亡动画进度（0.25s） */
  deadT: number;
  jellyPhase: number;
  /** 静止时长（待机动画） */
  idleT: number;
  moving: boolean;
  /** 移速倍率 */
  speedMul: number;
  brain: BotBrain | null;
  muzzleT: number;
  muzzleRot: number;
  recoilT: number;
  /** 击杀者信息（死亡覆盖层用） */
  lastKillerName: string;
  lastKillerWeapon: WeaponId;
}

export function currentWeaponId(c: Character): WeaponId {
  return WEAPON_ORDER[c.slot];
}

export function currentSlot(c: Character): WeaponSlot {
  return c.slots[c.slot];
}

export function makeSlots(): WeaponSlot[] {
  return WEAPON_ORDER.map((id) => ({
    owned: id === 'pistol',
    mag: WEAPONS[id].magazine,
    reserve: id === 'pistol' ? Infinity : 0,
  }));
}

export function createCharacter(opts: {
  id: string;
  name: string;
  color: string;
  colorDark: string;
  isPlayer: boolean;
  personality: BotPersonality | null;
  x: number;
  y: number;
}): Character {
  return {
    id: opts.id,
    name: opts.name,
    color: opts.color,
    colorDark: opts.colorDark,
    isPlayer: opts.isPlayer,
    personality: opts.personality,
    x: opts.x,
    y: opts.y,
    vx: 0,
    vy: 0,
    aim: 0,
    radius: 18,
    hp: PLAYER_HP,
    shield: 0,
    alive: true,
    respawnT: 0,
    invincibleT: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    streak: 0,
    streakBest: 0,
    slots: makeSlots(),
    slot: 0,
    sinceShot: 999,
    reloadT: 0,
    reloadTotal: 0,
    switchT: 0,
    bloomDeg: 0,
    sinceTrigger: 999,
    hitFlashT: 0,
    knockX: 0,
    knockY: 0,
    spawnT: 0,
    deadT: 0,
    jellyPhase: Math.random() * Math.PI * 2,
    idleT: 0,
    moving: false,
    speedMul: 1,
    brain: null,
    muzzleT: 0,
    muzzleRot: 0,
    recoilT: 0,
    lastKillerName: '',
    lastKillerWeapon: 'pistol',
  };
}

/* ------------------------------------------------------------------ */
/* 道具台                                                              */
/* ------------------------------------------------------------------ */

export interface Pad {
  type: ItemType;
  x: number;
  y: number;
  /** 道具是否在台上 */
  present: boolean;
  /** 刷新剩余秒数 */
  timer: number;
  /** 总刷新秒数（进度环用） */
  total: number;
  /** 悬浮相位 */
  phase: number;
  /** 刷新出现弹入 */
  popT: number;
}

/* ------------------------------------------------------------------ */
/* 对象池                                                              */
/* ------------------------------------------------------------------ */

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  traveled: number;
  maxDist: number;
  /** 射程（衰减起点） */
  range: number;
  damage: number;
  falloff: number;
  pierceLeft: number;
  firstHitId: string | null;
  ownerId: string;
  weapon: WeaponId;
  color: string;
}

export const BULLET_POOL_SIZE = 200;

export function createBulletPool(): Bullet[] {
  const pool: Bullet[] = [];
  for (let i = 0; i < BULLET_POOL_SIZE; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      traveled: 0,
      maxDist: 0,
      range: 0,
      damage: 0,
      falloff: 1,
      pierceLeft: 0,
      firstHitId: null,
      ownerId: '',
      weapon: 'pistol',
      color: '#fff',
    });
  }
  return pool;
}

/** 粒子种类：0 星星火花 / 1 尘雾 / 2 冲击环 / 3 幽灵表情 / 4 道具星星 */
export type ParticleKind = 0 | 1 | 2 | 3 | 4;

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  rot: number;
  vr: number;
}

export const PARTICLE_POOL_SIZE = 400;

export function createParticlePool(): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    pool.push({
      active: false,
      kind: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      color: '#fff',
      gravity: 0,
      rot: 0,
      vr: 0,
    });
  }
  return pool;
}

export interface DamageNumber {
  active: boolean;
  x: number;
  y: number;
  t: number;
  life: number;
  text: string;
  size: number;
  color: string;
}

export const DAMAGE_NUMBER_POOL_SIZE = 32;

export function createDamageNumberPool(): DamageNumber[] {
  const pool: DamageNumber[] = [];
  for (let i = 0; i < DAMAGE_NUMBER_POOL_SIZE; i++) {
    pool.push({ active: false, x: 0, y: 0, t: 0, life: 0.6, text: '', size: 16, color: '#fff' });
  }
  return pool;
}

export interface Decal {
  active: boolean;
  x: number;
  y: number;
  t: number;
  life: number;
}

export const DECAL_POOL_SIZE = 40;

export function createDecalPool(): Decal[] {
  const pool: Decal[] = [];
  for (let i = 0; i < DECAL_POOL_SIZE; i++) {
    pool.push({ active: false, x: 0, y: 0, t: 0, life: 0.2 });
  }
  return pool;
}

/* ------------------------------------------------------------------ */
/* 池分配工具（超出时替换最旧/轮转位）                                    */
/* ------------------------------------------------------------------ */

export function allocBullet(pool: Bullet[]): Bullet | null {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) return pool[i];
  }
  return null;
}

export function allocParticle(pool: Particle[], cursor: { i: number }): Particle {
  for (let n = 0; n < pool.length; n++) {
    cursor.i = (cursor.i + 1) % pool.length;
    if (!pool[cursor.i].active) return pool[cursor.i];
  }
  cursor.i = (cursor.i + 1) % pool.length;
  return pool[cursor.i];
}

export function allocDamageNumber(pool: DamageNumber[]): DamageNumber {
  let oldest = pool[0];
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) return pool[i];
    if (pool[i].t > oldest.t) oldest = pool[i];
  }
  return oldest;
}

export function allocDecal(pool: Decal[]): Decal {
  let oldest = pool[0];
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].active) return pool[i];
    if (pool[i].t > oldest.t) oldest = pool[i];
  }
  return oldest;
}

/** 护盾上限辅助 */
export function clampShield(v: number): number {
  return v < 0 ? 0 : v > SHIELD_MAX ? SHIELD_MAX : v;
}
