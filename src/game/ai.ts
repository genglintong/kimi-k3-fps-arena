/**
 * AI 行为系统（game.md §8）：状态机 PATROL ⇄ SEEK_ITEM ⇄ CHASE ⇄ ATTACK / FLEE。
 * 难度参数来自 constants.DIFFICULTIES；个性覆写来自 BOT_ROSTER personality。
 * 以下常量为 game.md §8.1/§8.2 的行为参数（constants.ts 未收录，故在此集中定义并注释出处）。
 */

import { WEAPONS, WEAPON_ORDER, PLAYER_HP } from './constants';
import type { Character, Pad, AiStateName } from './entities';
import { currentWeaponId } from './entities';
import type { DifficultyDef, WeaponId } from './constants';
import { dist2, hasLineOfSight, WAYPOINTS, AMBUSH_POINTS } from './world';

/* game.md §8.1 武器理想射程（霰弹 200 / 步枪 400 / 狙击 700；手枪未列，取中距 320） */
const IDEAL_RANGE: Record<WeaponId, number> = {
  pistol: 320,
  shotgun: 200,
  rifle: 400,
  sniper: 700,
};
/** game.md §8.1：FLEE 触发 HP<35%（铁皮蛋 15%）；HP>60% 退出 */
const FLEE_HP_ENTER = 0.35;
const FLEE_HP_ENTER_BERSERKER = 0.15;
const FLEE_HP_EXIT = 0.6;
/** FLEE 脱战 4s 退出；贴身 <120u 回击 */
const FLEE_DISENGAGE_S = 4;
const FLEE_FIGHTBACK_DIST = 120;
/** SEEK_ITEM：武器箱 <600u（手无长枪）；回血包 HP<70% <500u；护盾 <25 <500u */
const SEEK_BOX_DIST = 600;
const SEEK_MEDKIT_DIST = 500;
const SEEK_MEDKIT_HP = 0.7;
const SEEK_SHIELD_DIST = 500;
const SEEK_SHIELD_VAL = 25;
/** CHASE 丢失视线 3s → PATROL */
const LOSE_SIGHT_S = 3;
/** ATTACK 侧向走位 ±60u，周期 1.2–2s（暴躁菇 ×1.5） */
const STRAFE_AMP = 60;
/** SEEK 途中遇敌 <300u → CHASE */
const SEEK_ENGAGE_DIST = 300;
/** 老六伏击开火距离 <300u */
const CAMPER_ENGAGE_DIST = 300;
/** 神枪阿亮理想射程 800u */
const SNIPER_PERSONALITY_RANGE = 800;
/** 铁皮蛋理想射程 -40% */
const BERSERKER_RANGE_MUL = 0.6;

export interface AiContext {
  chars: Character[];
  pads: Pad[];
  diff: DifficultyDef;
  /** 游戏时间（秒） */
  now: number;
  /** 帧序号（视线轮转用） */
  frame: number;
}

function findChar(ctx: AiContext, id: string | null): Character | null {
  if (id === null) return null;
  for (const c of ctx.chars) {
    if (c.id === id) return c;
  }
  return null;
}

/** 感知半径内最近存活敌人 */
function nearestPerceivedEnemy(bot: Character, ctx: AiContext): Character | null {
  const per2 = ctx.diff.perception * ctx.diff.perception;
  let best: Character | null = null;
  let bestD2 = per2;
  for (const c of ctx.chars) {
    if (c === bot || !c.alive) continue;
    const d2 = dist2(bot.x, bot.y, c.x, c.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = c;
    }
  }
  return best;
}

function fleeThreshold(bot: Character): number {
  return bot.personality === 'berserker' ? FLEE_HP_ENTER_BERSERKER : FLEE_HP_ENTER;
}

/** 是否拥有「长枪」（非手枪） */
function hasLongGun(bot: Character): boolean {
  return bot.slots.some((s, i) => i !== 0 && s.owned);
}

/** 选择最佳武器槽（个性偏好 + 交战距离） */
function chooseWeaponSlot(bot: Character, distToTarget: number): number {
  const owned: WeaponId[] = [];
  for (let i = 1; i < WEAPON_ORDER.length; i++) {
    if (bot.slots[i].owned) owned.push(WEAPON_ORDER[i]);
  }
  if (owned.length === 0) return 0;
  let pref: WeaponId[];
  switch (bot.personality) {
    case 'berserker':
      pref = ['shotgun', 'rifle', 'sniper'];
      break;
    case 'gunner':
      pref = ['rifle', 'shotgun', 'sniper'];
      break;
    case 'sniper':
      pref = ['sniper', 'rifle', 'shotgun'];
      break;
    case 'roamer':
      pref = ['rifle', 'shotgun', 'sniper'];
      break;
    case 'camper':
      pref = ['shotgun', 'rifle', 'sniper'];
      break;
    default:
      pref =
        distToTarget > 500
          ? ['sniper', 'rifle', 'shotgun']
          : distToTarget < 250
            ? ['shotgun', 'rifle', 'sniper']
            : ['rifle', 'shotgun', 'sniper'];
  }
  for (const id of pref) {
    if (owned.indexOf(id) >= 0) return WEAPON_ORDER.indexOf(id);
  }
  return WEAPON_ORDER.indexOf(owned[0]);
}

function idealRange(bot: Character): number {
  const w = currentWeaponId(bot);
  if (bot.personality === 'sniper') {
    return w === 'sniper' ? SNIPER_PERSONALITY_RANGE : IDEAL_RANGE[w];
  }
  let r = IDEAL_RANGE[w];
  if (bot.personality === 'berserker') r *= BERSERKER_RANGE_MUL;
  return r;
}

/** SEEK_ITEM 候选评估（game.md §8.1 进入条件 + §8.2 抢道具倾向 + 个性权重） */
function evaluateSeek(bot: Character, ctx: AiContext): number {
  const greedBase = ctx.diff.itemGreed * (bot.personality === 'gunner' ? 2 : 1);
  let bestPad = -1;
  let bestScore = 1; // 阈值：欲望须超过 1
  for (let i = 0; i < ctx.pads.length; i++) {
    const pad = ctx.pads[i];
    const d = Math.sqrt(dist2(bot.x, bot.y, pad.x, pad.y));
    let weight = 0;
    if (pad.type === 'weaponbox') {
      if (pad.present) {
        if (!hasLongGun(bot) && d < SEEK_BOX_DIST) weight = 1.0;
        else if (bot.personality === 'sniper' && d < SEEK_BOX_DIST) weight = 0.9;
        else if (ctx.diff.itemGreed >= 0.9 && d < 400) weight = 0.5;
      } else if (ctx.diff.itemGreed >= 0.9 && pad.timer < 5 && d < 400) {
        weight = 0.6; // 困难：蹲刷新
      }
      if (bot.personality === 'gunner') weight *= 2;
    } else if (pad.type === 'medkit') {
      if (pad.present && bot.hp < SEEK_MEDKIT_HP * PLAYER_HP && d < SEEK_MEDKIT_DIST) {
        weight = 1.2 * (1 - bot.hp / PLAYER_HP + 0.4);
      }
    } else {
      const shieldThreshold = bot.personality === 'roamer' ? 60 : SEEK_SHIELD_VAL;
      if (pad.present && bot.shield < shieldThreshold && d < SEEK_SHIELD_DIST) {
        weight = bot.personality === 'roamer' ? 1.6 : 0.8;
      }
    }
    if (weight <= 0) continue;
    const score = (weight * greedBase * 1000) / Math.max(d, 80);
    if (score > bestScore) {
      bestScore = score;
      bestPad = i;
    }
  }
  return bestPad;
}

function pickWaypoint(bot: Character): void {
  const b = bot.brain!;
  if (bot.personality === 'camper') {
    b.ambushIdx = Math.floor(Math.random() * AMBUSH_POINTS.length);
    const p = AMBUSH_POINTS[b.ambushIdx];
    b.waypointX = p[0];
    b.waypointY = p[1];
    b.repathT = 8 + Math.random() * 4;
    return;
  }
  const p = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
  b.waypointX = p[0];
  b.waypointY = p[1];
  b.repathT = 2 + Math.random() * 2;
}

function setState(bot: Character, state: AiStateName): void {
  const b = bot.brain!;
  if (b.state === state) return;
  b.state = state;
  if (state === 'flee') b.fleeT = 0;
  if (state === 'patrol') {
    b.targetId = null;
    b.targetVisible = false;
    b.seekPad = -1;
    b.repathT = 0;
  }
}

/**
 * 每帧更新一个机器人。输出：brain.moveX/moveY（含减速系数的方向）、wantFire、aimX/aimY。
 * 视线判定按帧轮转 (frame + losOffset) % 2，同帧最多半数 AI 做射线检测（game.md §13）。
 */
export function updateBot(bot: Character, ctx: AiContext, dt: number): void {
  const b = bot.brain!;
  b.wantFire = false;
  b.moveX = 0;
  b.moveY = 0;
  if (!bot.alive) return;

  const diff = ctx.diff;
  const now = ctx.now;

  /* ---------------- 感知（轮转 LOS） ---------------- */
  const losFrame = (ctx.frame + b.losOffset) % 2 === 0;
  let target = findChar(ctx, b.targetId);
  if (target && !target.alive) {
    target = null;
    b.targetId = null;
    b.targetVisible = false;
    if (b.state === 'attack' || b.state === 'chase') setState(bot, 'patrol');
  }
  if (losFrame) {
    const perceived = nearestPerceivedEnemy(bot, ctx);
    if (perceived) {
      const visible = hasLineOfSight(bot.x, bot.y, perceived.x, perceived.y);
      if (visible) {
        if (b.targetId !== perceived.id) {
          b.targetId = perceived.id;
          b.acquiredAt = now;
        }
        b.targetVisible = true;
        b.lastSeenAt = now;
      } else if (b.targetId === perceived.id || b.targetId === null) {
        b.targetVisible = false;
      }
    } else {
      b.targetVisible = false;
    }
    target = findChar(ctx, b.targetId);
  } else {
    target = findChar(ctx, b.targetId);
    if (target && dist2(bot.x, bot.y, target.x, target.y) > diff.perception * diff.perception * 1.44) {
      b.targetVisible = false;
    }
  }

  const targetDist = target ? Math.sqrt(dist2(bot.x, bot.y, target.x, target.y)) : Infinity;
  const threatened = (target !== null && b.targetVisible) || now - b.lastHurtAt < 1.2;

  /* ---------------- 状态切换 ---------------- */
  const hpFrac = bot.hp / PLAYER_HP;
  if (b.state !== 'flee' && hpFrac < fleeThreshold(bot) && threatened) {
    setState(bot, 'flee');
  }

  switch (b.state) {
    case 'patrol': {
      if (target && b.targetVisible) {
        setState(bot, 'chase');
        break;
      }
      b.decideT -= dt;
      if (b.decideT <= 0) {
        b.decideT = 0.4 + Math.random() * 0.2;
        const pad = evaluateSeek(bot, ctx);
        if (pad >= 0) {
          b.seekPad = pad;
          setState(bot, 'seek');
          break;
        }
      }
      break;
    }
    case 'seek': {
      const pad = b.seekPad >= 0 ? ctx.pads[b.seekPad] : null;
      if (!pad || (!pad.present && pad.timer > 6)) {
        setState(bot, 'patrol');
        break;
      }
      if (target && b.targetVisible && targetDist < SEEK_ENGAGE_DIST) {
        setState(bot, 'chase');
        break;
      }
      break;
    }
    case 'chase': {
      if (!target) {
        setState(bot, 'patrol');
        break;
      }
      if (b.targetVisible && targetDist <= idealRange(bot)) {
        setState(bot, 'attack');
        break;
      }
      if (now - b.lastSeenAt > LOSE_SIGHT_S) {
        setState(bot, 'patrol');
        break;
      }
      break;
    }
    case 'attack': {
      if (!target) {
        setState(bot, 'patrol');
        break;
      }
      if (!b.targetVisible) {
        setState(bot, 'chase');
        break;
      }
      if (targetDist > idealRange(bot) * 1.2) {
        setState(bot, 'chase');
        break;
      }
      break;
    }
    case 'flee': {
      b.fleeT += dt;
      if (target && b.targetVisible) b.fleeT = 0;
      if (now - b.lastHurtAt < 1) b.fleeT = 0;
      if (hpFrac >= FLEE_HP_EXIT || b.fleeT > FLEE_DISENGAGE_S) {
        setState(bot, 'patrol');
        break;
      }
      break;
    }
  }

  /* ---------------- 换武器 ---------------- */
  if (bot.switchT <= 0 && bot.reloadT <= 0) {
    const want = chooseWeaponSlot(bot, targetDist === Infinity ? 400 : targetDist);
    if (want !== bot.slot && bot.slots[want].owned) {
      bot.slot = want;
      bot.switchT = 0.25;
      bot.reloadT = 0;
    }
  }

  /* ---------------- 行为（移动 + 开火意图） ---------------- */
  const curWeapon = WEAPONS[currentWeaponId(bot)];
  const canReact = target !== null && (now - b.acquiredAt) * 1000 >= diff.reactionMs;

  /** 朝目标点开火（预判 + 难度误差） */
  const aimAtTarget = (spreadMul: number): void => {
    if (!target) return;
    const tof = targetDist / curWeapon.bulletSpeed;
    const px = target.x + target.vx * tof;
    const py = target.y + target.vy * tof;
    let errDeg = diff.aimErrorDeg * spreadMul;
    const tSpeed = Math.sqrt(target.vx * target.vx + target.vy * target.vy);
    if (tSpeed > 60) errDeg *= 1.3; // 目标移动时误差 +30%
    const err = ((Math.random() * 2 - 1) * errDeg * Math.PI) / 180;
    const ang = Math.atan2(py - bot.y, px - bot.x) + err;
    b.aimX = bot.x + Math.cos(ang) * 200;
    b.aimY = bot.y + Math.sin(ang) * 200;
    b.wantFire = true;
  };

  switch (b.state) {
    case 'patrol': {
      b.repathT -= dt;
      const arrived = dist2(bot.x, bot.y, b.waypointX, b.waypointY) < 60 * 60;
      if (b.repathT <= 0 || arrived || (b.waypointX === 0 && b.waypointY === 0)) {
        pickWaypoint(bot);
      }
      if (bot.personality === 'camper') {
        const atSpot = dist2(bot.x, bot.y, b.waypointX, b.waypointY) < 30 * 30;
        if (!atSpot) {
          const d = Math.sqrt(dist2(bot.x, bot.y, b.waypointX, b.waypointY));
          b.moveX = (b.waypointX - bot.x) / d;
          b.moveY = (b.waypointY - bot.y) / d;
        } else {
          // 蹲守：缓慢扫视
          b.aimX = bot.x + Math.cos(now * 0.6 + b.strafePhase) * 100;
          b.aimY = bot.y + Math.sin(now * 0.6 + b.strafePhase) * 100;
        }
      } else {
        const d = Math.sqrt(dist2(bot.x, bot.y, b.waypointX, b.waypointY));
        if (d > 40) {
          b.moveX = ((b.waypointX - bot.x) / d) * 0.7; // 巡逻速度 ×0.7
          b.moveY = ((b.waypointY - bot.y) / d) * 0.7;
        }
      }
      break;
    }
    case 'seek': {
      const pad = ctx.pads[b.seekPad];
      if (pad) {
        const d = Math.sqrt(dist2(bot.x, bot.y, pad.x, pad.y));
        if (d > 30) {
          b.moveX = (pad.x - bot.x) / d;
          b.moveY = (pad.y - bot.y) / d;
        }
        // 途中仍可开火（精度 ×1.5 散布）
        if (target && b.targetVisible && canReact && targetDist < curWeapon.range) {
          aimAtTarget(1.5);
        }
      }
      break;
    }
    case 'chase': {
      if (target) {
        const ideal = idealRange(bot);
        const d = Math.max(targetDist, 1);
        let mx = (target.x - bot.x) / d;
        let my = (target.y - bot.y) / d;
        if (!b.targetVisible) {
          // 掩体在射线中则绕射：叠加垂直漂移
          const px = -my * b.strafeDir;
          const py = mx * b.strafeDir;
          mx += px * 0.8;
          my += py * 0.8;
          if (Math.random() < dt * 0.8) b.strafeDir *= -1;
        } else if (d < ideal * 0.6) {
          mx *= -0.5;
          my *= -0.5;
        }
        const len = Math.hypot(mx, my) || 1;
        b.moveX = mx / len;
        b.moveY = my / len;
        if (b.targetVisible && canReact && targetDist < curWeapon.range * 0.9) {
          aimAtTarget(1);
        } else if (b.targetVisible) {
          b.aimX = target.x;
          b.aimY = target.y;
        }
      }
      break;
    }
    case 'attack': {
      if (target) {
        b.strafePhase += ((Math.PI * 2) / b.strafePeriod) * dt;
        const d = Math.max(targetDist, 1);
        const tx = (target.x - bot.x) / d;
        const ty = (target.y - bot.y) / d;
        const amp = bot.personality === 'gunner' ? STRAFE_AMP * 1.5 : STRAFE_AMP;
        const strafe = Math.cos(b.strafePhase) * (amp / 60);
        const radial = (d - idealRange(bot)) / 120;
        let mx = tx * radial + -ty * strafe;
        let my = ty * radial + tx * strafe;
        const len = Math.hypot(mx, my);
        if (len > 1) {
          mx /= len;
          my /= len;
        }
        b.moveX = mx;
        b.moveY = my;
        if (canReact && targetDist <= curWeapon.range * 1.02) {
          aimAtTarget(1);
        } else {
          b.aimX = target.x;
          b.aimY = target.y;
        }
        if (bot.personality === 'camper') {
          b.moveX = 0;
          b.moveY = 0;
        }
      }
      break;
    }
    case 'flee': {
      let fleeFromX = bot.x;
      let fleeFromY = bot.y;
      if (target) {
        fleeFromX = target.x;
        fleeFromY = target.y;
      }
      let destX = bot.x + (bot.x - fleeFromX);
      let destY = bot.y + (bot.y - fleeFromY);
      let bestMed = -1;
      let bestMedD = Infinity;
      for (let i = 0; i < ctx.pads.length; i++) {
        const p = ctx.pads[i];
        if (p.type !== 'medkit' || !p.present) continue;
        const d2 = dist2(bot.x, bot.y, p.x, p.y);
        if (d2 < bestMedD) {
          bestMedD = d2;
          bestMed = i;
        }
      }
      if (bestMed >= 0) {
        destX = ctx.pads[bestMed].x;
        destY = ctx.pads[bestMed].y;
      }
      const d = Math.max(Math.hypot(destX - bot.x, destY - bot.y), 1);
      b.moveX = (destX - bot.x) / d;
      b.moveY = (destY - bot.y) / d;
      // 贴身才回击
      if (target && b.targetVisible && targetDist < FLEE_FIGHTBACK_DIST && canReact) {
        aimAtTarget(1);
      }
      break;
    }
  }

  /* camper：敌人 <300u 才开火 */
  if (bot.personality === 'camper' && b.wantFire && targetDist > CAMPER_ENGAGE_DIST) {
    b.wantFire = false;
  }

  /* 卡死检测：被掩体卡住时绕行 */
  const moved = dist2(bot.x, bot.y, b.lastX, b.lastY);
  const wantsMove = b.moveX !== 0 || b.moveY !== 0;
  if (wantsMove && moved < 20 * dt * (20 * dt)) {
    b.stuckT += dt;
    if (b.stuckT > 0.5 && b.detourT <= 0) {
      b.detourT = 0.6;
      b.detourDir = Math.random() < 0.5 ? 1 : -1;
      b.stuckT = 0;
    }
  } else {
    b.stuckT = 0;
  }
  if (b.detourT > 0) {
    b.detourT -= dt;
    const px = -b.moveY * b.detourDir;
    const py = b.moveX * b.detourDir;
    b.moveX = (b.moveX + px * 1.4) / 1.7;
    b.moveY = (b.moveY + py * 1.4) / 1.7;
  }
  b.lastX = bot.x;
  b.lastY = bot.y;
}

/** 机器人移动速度（§8.2 难度速度；跑跑姜 +10%；撤退 ×1.1；巡逻 ×0.7 已在 moveX/Y 中体现） */
export function botSpeed(bot: Character, ctx: AiContext): number {
  let s = ctx.diff.speed;
  if (bot.personality === 'roamer') s *= 1.1;
  if (bot.brain!.state === 'flee') s *= 1.1;
  return s * bot.speedMul;
}
