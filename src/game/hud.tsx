/**
 * /play DOM HUD（game.md §10）：计时器、玩家状态卡、迷你积分榜、击杀播报、
 * 武器槽、死亡/暂停/结束覆盖层、屏幕空间反馈、设备提示层。
 * 全部 pointer-events:none（覆盖层内按钮自行恢复 auto）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { ArenaButton, ArenaPanel, PlayerBadge, Toggle, KillFeedItem } from '@/components/arena';
import { WEAPONS, WEAPON_ORDER, PLAYER_HP, SHIELD_MAX } from '@/game/constants';
import type { WeaponId } from '@/game/constants';
import type { HudSnapshot } from '@/game/engine';
import { audio } from '@/game/audio';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* 局部 CSS 动画（游戏页私有，不污染全局）                               */
/* ------------------------------------------------------------------ */

export function HudStyles() {
  return (
    <style>{`
      @keyframes ga-hp-breathe {
        0%, 100% { border-color: rgba(255,90,95,0.25); }
        50% { border-color: rgba(255,90,95,1); }
      }
      @keyframes ga-vignette-breathe {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 0.75; }
      }
      @keyframes ga-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
      @keyframes ga-timer-pulse {
        0% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      @keyframes ga-confetti {
        0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
        100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
      }
      @keyframes ga-lowhp-corner {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.015); }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* 10.1 顶部中央 · 计时器                                              */
/* ------------------------------------------------------------------ */

export function TimerHud({ hud }: { hud: HudSnapshot }) {
  const sec = Math.ceil(hud.timeLeftS);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const text = `${m}:${String(s).padStart(2, '0')}`;
  const danger = hud.overtime || hud.lowTime;
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
      <div
        className={cn(
          'flex h-16 items-center rounded-full border-2 border-white/10 bg-bg-panel/80 px-6 backdrop-blur-sm panel-highlight',
          danger && !hud.overtime && 'border-red/60',
          hud.overtime && 'border-pur/70',
        )}
      >
        <span
          key={sec}
          className={cn(
            'font-num text-[44px] leading-none text-white',
            danger && !hud.overtime && 'text-red',
            hud.overtime && 'text-pur',
          )}
          style={
            danger
              ? { animation: 'ga-timer-pulse 1s ease-out', display: 'inline-block' }
              : { display: 'inline-block' }
          }
        >
          {text}
        </span>
      </div>
      <div className="mt-1.5 flex justify-center gap-1.5">
        {hud.overtime ? (
          <span className="rounded-full border border-pur/50 bg-void/70 px-3 text-[12px] font-bold leading-5 text-pur backdrop-blur-sm">
            加时 · 突然死亡
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-void/70 px-3 font-num text-[12px] leading-5 text-yel backdrop-blur-sm">
            击杀 {hud.kills}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10.2 左上 · 玩家状态卡                                              */
/* ------------------------------------------------------------------ */

export function PlayerCard({ hud, hitTick }: { hud: HudSnapshot; hitTick: number }) {
  const controls = useAnimationControls();
  useEffect(() => {
    if (hitTick > 0) {
      void controls.start({ x: [0, -5, 5, -3, 0], transition: { duration: 0.25 } });
    }
  }, [hitTick, controls]);

  const cur = hud.weapons.find((w) => w.current) ?? hud.weapons[0];
  const def = WEAPONS[cur.id];
  const hpFrac = Math.max(0, hud.hp / PLAYER_HP);
  const lowHp = hud.hp < 30 && hud.alive;
  const ammoText = cur.reserve === Infinity ? `${cur.mag} / ∞` : `${cur.mag} / ${cur.reserve}`;

  return (
    <motion.div animate={controls} className="pointer-events-none absolute left-4 top-4 z-10">
      <div
        className={cn(
          'relative w-72 overflow-hidden rounded-2xl border-2 border-white/[0.08] bg-bg-panel p-4 panel-highlight',
          lowHp && 'border-red',
        )}
        style={lowHp ? { animation: 'ga-hp-breathe 1s ease-in-out infinite' } : undefined}
      >
        {/* 行1：头像 + 名字 + 连杀芯片 */}
        <div className="flex items-center gap-3">
          <PlayerBadge name="你" color="#3EA6FF" size={48} face={hud.alive ? 'smile' : 'dead'} avatarOnly />
          <div className="min-w-0 flex-1">
            <div className="font-head text-xl tracking-wide text-txt">你</div>
            <div className="text-[12px] text-txt-dim">
              击杀 {hud.kills}
            </div>
          </div>
          {hud.streak >= 3 ? (
            <span className="rounded-full border-2 border-ink bg-org px-2 py-0.5 text-[13px] font-bold text-ink">
              🔥×{hud.streak}
            </span>
          ) : null}
        </div>

        {/* 行2：HP 条（白影延迟跟随） */}
        <div className="relative mt-3 h-4 w-full overflow-hidden rounded-full border border-ink/60 bg-ink/40">
          <div
            className="absolute inset-y-0 left-0 bg-white/50"
            style={{
              width: `${hpFrac * 100}%`,
              transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1) 0.3s',
            }}
          />
          <div
            className={cn('absolute inset-y-0 left-0', hpFrac < 0.3 ? 'bg-red' : 'bg-grn')}
            style={{ width: `${hpFrac * 100}%`, transition: 'width 0.15s ease-out' }}
          />
          <span className="absolute inset-0 grid place-items-center font-num text-[11px] leading-none text-white drop-shadow-[0_1px_0_rgba(20,18,46,0.9)]">
            {hud.hp}
          </span>
        </div>

        {/* 行3：护盾条 */}
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-ink/60 bg-ink/40">
          <div
            className="h-full bg-blu"
            style={{
              width: `${Math.max(0, hud.shield / SHIELD_MAX) * 100}%`,
              transition: 'width 0.2s ease-out',
            }}
          />
        </div>

        {/* 行4：当前武器 + 弹药 */}
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-bg-panel-2/70 px-3 py-2">
          <div className="relative grid h-10 w-14 shrink-0 place-items-center">
            <img src={def.image} alt={def.name} className="max-h-10 w-auto" draggable={false} />
            {cur.reloading ? (
              <svg viewBox="0 0 36 36" className="absolute inset-0 m-auto h-9 w-9 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(20,18,46,0.5)" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#FFC831"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 15}
                  strokeDashoffset={2 * Math.PI * 15 * (1 - cur.reloadFrac)}
                />
              </svg>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold" style={{ color: def.color }}>
              {def.name}
            </div>
            {cur.reloading ? (
              <div className="text-[12px] font-bold text-yel" style={{ animation: 'ga-blink 0.5s step-end infinite' }}>
                换弹中…
              </div>
            ) : (
              <div className="font-num text-[24px] leading-none text-white">{ammoText}</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 10.3 右上 · 迷你积分榜                                              */
/* ------------------------------------------------------------------ */

export interface BoardFlash {
  [id: string]: number;
}

export function Scoreboard({ hud, ended }: { hud: HudSnapshot; ended: boolean }) {
  const player = hud.board.find((r) => r.isPlayer)!;
  const others = hud.board.filter((r) => !r.isPlayer).slice(0, 4);
  const rows = [player, ...others];
  const killsRef = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<BoardFlash>({});

  useEffect(() => {
    const next: BoardFlash = {};
    let changed = false;
    for (const r of hud.board) {
      const prev = killsRef.current[r.id];
      if (prev !== undefined && r.kills > prev) {
        next[r.id] = Date.now();
        changed = true;
      }
      killsRef.current[r.id] = r.kills;
    }
    if (changed) {
      setFlash((f) => ({ ...f, ...next }));
      const t = setTimeout(() => setFlash({}), 450);
      return () => clearTimeout(t);
    }
  }, [hud.board]);

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-10 w-56">
      <ArenaPanel className="p-3" contentClassName="relative">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-head text-lg tracking-wide text-txt">积分榜</span>
          <span className="text-[11px] text-txt-dim">击杀定胜负</span>
        </div>
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => {
              const isWinnerRow = ended && hud.board.length > 0 && r.id === hud.board[0].id;
              const flashing = flash[r.id] !== undefined;
              return (
                <motion.div
                  key={r.id}
                  layout="position"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5',
                    r.isPlayer ? 'border border-yel/40 bg-yel/15' : 'bg-bg-panel-2/50',
                    flashing && 'bg-yel/40',
                    isWinnerRow && 'border-2 border-yel shadow-glow-yel',
                  )}
                >
                  <span className="w-4 text-center font-num text-[11px] text-txt-dim">{i + 1}</span>
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-ink"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className={cn('min-w-0 flex-1 truncate text-[13px]', r.isPlayer ? 'font-bold text-txt' : 'text-txt-mute')}>
                    {r.name}
                  </span>
                  <motion.span
                    key={r.kills}
                    initial={{ scale: 1.4 }}
                    animate={{ scale: 1 }}
                    className="font-num text-[14px] text-white"
                  >
                    {r.kills}
                    <span className="text-txt-dim">/{r.deaths}</span>
                  </motion.span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ArenaPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10.4 击杀播报                                                       */
/* ------------------------------------------------------------------ */

export interface FeedItem {
  id: number;
  killerName: string;
  killerColor: string;
  victimName: string;
  victimColor: string;
  weapon: WeaponId;
  highlight: boolean;
}

export function KillFeed({ items }: { items: FeedItem[] }) {
  return (
    <div className="pointer-events-none absolute right-4 top-[212px] z-10 flex w-64 flex-col items-end gap-1.5">
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <KillFeedItem
            key={it.id}
            killerName={it.killerName}
            killerColor={it.killerColor}
            victimName={it.victimName}
            victimColor={it.victimColor}
            weapon={it.weapon}
            highlight={it.highlight}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10.5 底部中央 · 武器槽                                              */
/* ------------------------------------------------------------------ */

export function WeaponSlots({ hud, pulseTick }: { hud: HudSnapshot; pulseTick: number }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
      {hud.weapons.map((w, i) => {
        const def = WEAPONS[w.id];
        const ammo = w.reserve === Infinity ? '∞' : String(w.mag + w.reserve);
        return (
          <motion.div
            key={`${w.id}-${pulseTick}`}
            initial={pulseTick > 0 && w.current ? { scale: 0.7 } : false}
            animate={{ scale: w.current ? 1.12 : 1 }}
            transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            className={cn(
              'relative grid h-14 w-16 place-items-center rounded-xl border-2 bg-bg-panel/80 backdrop-blur-sm',
              w.current ? 'border-yel' : 'border-white/10',
              !w.owned && 'opacity-35 saturate-50',
            )}
          >
            <span
              className="absolute inset-x-0 top-0 h-[3px] rounded-t-md"
              style={{ backgroundColor: w.owned ? def.color : 'transparent' }}
            />
            <span className="absolute left-1 top-0.5 font-num text-[11px] text-txt-dim">{i + 1}</span>
            <img src={def.image} alt={def.name} className="max-h-8 w-auto" draggable={false} />
            <span className="absolute bottom-0.5 right-1 font-num text-[10px] text-txt-mute">
              {w.owned ? ammo : WEAPON_ORDER[i] === 'pistol' ? '∞' : '—'}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10.9 死亡与重生覆盖层                                               */
/* ------------------------------------------------------------------ */

export function DeathOverlay({ hud }: { hud: HudSnapshot }) {
  const frac = Math.max(0, Math.min(1, hud.respawnT / 3));
  const C = 2 * Math.PI * 34;
  return (
    <AnimatePresence>
      {!hud.alive && hud.phase === 'live' ? (
        <motion.div
          key="death-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-0 z-20 grid place-items-center bg-[rgba(15,16,48,0.6)]"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              className="font-display text-[56px] leading-tight text-white text-stroke-ink"
            >
              你被 {hud.killerName} 淘汰了！
            </motion.div>
            <div className="mt-2 flex items-center justify-center gap-2 text-txt-mute">
              <img
                src={WEAPONS[hud.killerWeapon].image}
                alt={WEAPONS[hud.killerWeapon].name}
                className="h-8 w-auto"
                draggable={false}
              />
              <span className="text-sm">{WEAPONS[hud.killerWeapon].name}</span>
            </div>
            <div className="relative mx-auto mt-6 h-24 w-24">
              <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="#FFC831"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * frac}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center font-num text-[40px] text-white">
                {Math.max(1, Math.ceil(hud.respawnT))}
              </span>
            </div>
            <div className="mt-4 text-[13px] text-txt-dim">正在寻找安全出生点…</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* 10.10 暂停覆盖层                                                    */
/* ------------------------------------------------------------------ */

export interface PauseSettingsProps {
  sound: boolean;
  volume: number;
  shake: boolean;
  damageNumbers: boolean;
  killFeed: boolean;
}

export function PauseOverlay({
  open,
  settings,
  onApply,
  onResume,
  onQuit,
}: {
  open: boolean;
  settings: PauseSettingsProps;
  onApply: (patch: Partial<PauseSettingsProps>) => void;
  onResume: () => void;
  onQuit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pause-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-30 grid place-items-center bg-[rgba(15,16,48,0.7)] backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <ArenaPanel className="w-96 max-w-[92vw] p-8">
              <h2 className="font-display text-5xl text-txt text-stroke-ink">暂停</h2>
              <p className="mt-1 text-[13px] text-txt-dim">比赛已冻结</p>

              <div className="mt-6">
                <ArenaButton variant="primary" size="lg" className="w-full" onClick={onResume}>
                  继续战斗
                </ArenaButton>
              </div>

              <div className="mt-6 divide-y divide-line-soft/50 border-t border-line-soft/60">
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-bold text-txt">音效</span>
                  <Toggle checked={settings.sound} onChange={(v) => onApply({ sound: v })} aria-label="音效开关" />
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-bold text-txt">音量</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.volume}
                    aria-label="音量"
                    onChange={(e) => onApply({ volume: Number(e.target.value) })}
                    onPointerUp={() => audio.playUiClick()}
                    className="arena-slider w-32"
                    style={{
                      background: `linear-gradient(to right, #FFC831 0%, #FFC831 ${settings.volume}%, #15173D ${settings.volume}%, #15173D 100%)`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-bold text-txt">屏幕震动</span>
                  <Toggle checked={settings.shake} onChange={(v) => onApply({ shake: v })} aria-label="屏幕震动开关" />
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-bold text-txt">伤害数字</span>
                  <Toggle
                    checked={settings.damageNumbers}
                    onChange={(v) => onApply({ damageNumbers: v })}
                    aria-label="伤害数字开关"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-bold text-txt">击杀播报</span>
                  <Toggle checked={settings.killFeed} onChange={(v) => onApply({ killFeed: v })} aria-label="击杀播报开关" />
                </div>
              </div>

              <div className="mt-6">
                {confirming ? (
                  <div className="flex gap-2">
                    <ArenaButton variant="danger" size="sm" className="flex-1" onClick={onQuit}>
                      确认放弃
                    </ArenaButton>
                    <ArenaButton variant="ghost" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
                      取消
                    </ArenaButton>
                  </div>
                ) : (
                  <ArenaButton variant="danger" size="md" className="w-full" onClick={() => setConfirming(true)}>
                    放弃比赛
                  </ArenaButton>
                )}
              </div>
            </ArenaPanel>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* 10.11 比赛结束横幅 + 金色礼花                                        */
/* ------------------------------------------------------------------ */

export function TimeUpBanner({ title, show }: { title: string; show: boolean }) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: 50 + (Math.random() - 0.5) * 30,
        dx: `${(Math.random() - 0.5) * 320}px`,
        dy: `${120 + Math.random() * 260}px`,
        rot: `${(Math.random() - 0.5) * 720}deg`,
        color: ['#FFC831', '#3EA6FF', '#FF6FB5', '#3ED97E', '#FFFFFF'][i % 5],
        delay: Math.random() * 0.25,
      })),
    [],
  );
  return (
    <AnimatePresence>
      {show ? (
        <div key="timeup" className="pointer-events-none fixed inset-0 z-20">
          <motion.div
            initial={{ scale: 2.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute left-1/2 top-[30%] -translate-x-1/2 font-display text-[72px] leading-none text-yel text-stroke-ink-lg"
          >
            {title}
          </motion.div>
          {confetti.map((c) => (
            <span
              key={c.id}
              aria-hidden
              className="absolute h-2.5 w-2.5 rounded-[3px]"
              style={{
                left: `${c.left}%`,
                top: '34%',
                backgroundColor: c.color,
                animation: `ga-confetti 1.1s ease-out ${c.delay}s both`,
                ['--dx' as string]: c.dx,
                ['--dy' as string]: c.dy,
                ['--rot' as string]: c.rot,
              }}
            />
          ))}
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/** 玩家触发连杀/首杀时的横幅两侧礼花 */
export function BannerConfetti({ tick }: { tick: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        return {
          id: i,
          left: side < 0 ? 32 : 68,
          dx: `${side * (60 + Math.random() * 140)}px`,
          dy: `${-40 - Math.random() * 160}px`,
          rot: `${(Math.random() - 0.5) * 540}deg`,
          color: ['#FFC831', '#FFFFFF', '#FF8A3D'][i % 3],
          delay: Math.random() * 0.15,
        };
      }),
    // 每次 tick 变化重新生成
    [tick],
  );
  if (tick === 0) return null;
  return (
    <div key={tick} className="pointer-events-none fixed inset-0 z-[85]">
      {parts.map((p) => (
        <span
          key={p.id}
          aria-hidden
          className="absolute h-2 w-3 rounded-[2px]"
          style={{
            left: `${p.left}%`,
            top: '30%',
            backgroundColor: p.color,
            animation: `ga-confetti 0.9s ease-out ${p.delay}s both`,
            ['--dx' as string]: `${p.dx}`,
            ['--dy' as string]: `calc(${p.dy} * -1 + 200px)`,
            ['--rot' as string]: p.rot,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10.8 屏幕空间反馈                                                   */
/* ------------------------------------------------------------------ */

export function ScreenFx({ hud, hitTick }: { hud: HudSnapshot; hitTick: number }) {
  const lowHp = hud.alive && hud.hp < 30 && hud.phase === 'live';
  const critical = hud.alive && hud.hp < 15 && hud.phase === 'live';
  const invincible = hud.alive && hud.invincibleT > 0 && hud.phase === 'live';
  return (
    <>
      {/* 受击红晕闪 */}
      {hitTick > 0 ? (
        <div
          key={hitTick}
          className="pointer-events-none fixed inset-0 z-[15]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,90,95,0.55) 100%)',
            animation: 'ga-damage-flash 0.3s ease-out both',
          }}
        />
      ) : null}
      <style>{`@keyframes ga-damage-flash { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }`}</style>
      {/* 低血量持续红晕呼吸 */}
      {lowHp ? (
        <div
          className="pointer-events-none fixed inset-0 z-[15]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(255,90,95,0.5) 100%)',
            animation: 'ga-vignette-breathe 1s ease-in-out infinite',
          }}
        />
      ) : null}
      {/* HP<15 四角轻微脉动 */}
      {critical ? (
        <div
          className="pointer-events-none fixed inset-0 z-[14] border-[10px] border-red/20"
          style={{ animation: 'ga-lowhp-corner 0.8s ease-in-out infinite' }}
        />
      ) : null}
      {/* 重生无敌：屏幕边缘 blu 细光 */}
      {invincible ? (
        <div
          className="pointer-events-none fixed inset-0 z-[15]"
          style={{ boxShadow: 'inset 0 0 0 4px rgba(62,166,255,0.55), inset 0 0 32px rgba(62,166,255,0.25)' }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* §12 设备提示层（移动端拦截）                                         */
/* ------------------------------------------------------------------ */

export function DeviceBlock() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    audio.playUiClick();
    const url = window.location.origin + window.location.pathname;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    }
  };
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-bg-deep bg-doodle p-8 text-center">
      <img src="/logo.svg" alt="枪火竞技场" className="w-64 max-w-full" draggable={false} />
      <img
        src="/menu-hero.svg"
        alt="竞技场插画"
        className="w-full max-w-md rounded-2xl border-2 border-white/10"
        draggable={false}
      />
      <h1 className="font-display text-4xl text-txt text-stroke-ink">这局枪战需要键盘和鼠标！</h1>
      <p className="max-w-md text-sm leading-7 text-txt-mute">
        《枪火竞技场》的实时对战需要 WASD 移动 + 鼠标瞄准射击。
        请在电脑浏览器中打开本页面，即刻开战！
      </p>
      <ArenaButton variant="primary" size="md" onClick={copy}>
        {copied ? '链接已复制！' : '复制链接到桌面'}
      </ArenaButton>
    </div>
  );
}
