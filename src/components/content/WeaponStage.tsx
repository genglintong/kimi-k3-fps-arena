/**
 * 武器详情台（armory.md §2 §3）：
 * 左侧武器选择列（Tab，支持 ↑↓ 键盘切换）+ 右侧插画台 / 能力条 / 实战面板 / 使用技巧。
 * 点击插画或「试射」按钮触发试射彩蛋（星形粒子 + audio.playShot）。
 * 所有数值由 weaponMetrics 从 WEAPONS 实时推导。
 */

import { memo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import ArenaButton from '@/components/arena/ArenaButton';
import ArenaPanel from '@/components/arena/ArenaPanel';
import Chip from '@/components/arena/Chip';
import StatBar from '@/components/arena/StatBar';
import { WEAPONS, WEAPON_ORDER } from '@/game/constants';
import type { WeaponId } from '@/game/constants';
import { audio } from '@/game/audio';
import { cn } from '@/lib/utils';
import { EASE_BOUNCE, EASE_SNAP } from './shared';
import {
  BAR_DEFS,
  obtainMethod,
  reloadSeconds,
  shotsToKill,
  theoreticalDps,
  weaponBars,
} from './weaponMetrics';

/* ------------------------------------------------------------------ */
/* 文案（性格标签与使用技巧，armory.md §3）                                */
/* ------------------------------------------------------------------ */

const WEAPON_TAGS: Record<WeaponId, string[]> = {
  pistol: ['可靠', '无限弹', '中距离'],
  shotgun: ['近战', '爆发', '高风险'],
  rifle: ['全自动', '压制', '中远距'],
  sniper: ['一枪入魂', '超远距', '穿透'],
};

const WEAPON_TIPS: Record<WeaponId, string> = {
  pistol: '你的老朋友。弹尽粮绝时它永远在，保持中距离点射，别和狙击对枪。',
  shotgun: '绕掩体、贴脸、一发入魂。射程外就是烧火棍，别犹豫，冲！',
  rifle: '按住左键就是雨。连射会越来越飘，点射与扫射交替是高手节奏。',
  sniper: `一枪 ${WEAPONS.sniper.damage}，两枪入魂。架住走廊尽头，让敌人自己走进十字线。`,
};

/* ------------------------------------------------------------------ */
/* 试射彩蛋粒子                                                          */
/* ------------------------------------------------------------------ */

/** 6 粒星形火花的方向（60° 间隔，半径 ~52px） */
const SPARK_DIRS = Array.from({ length: 6 }, (_, i) => {
  const rad = (Math.PI / 3) * i - Math.PI / 6;
  return { x: Math.cos(rad) * 52, y: Math.sin(rad) * 52 };
});

function Spark({ x, y }: { x: number; y: number }) {
  return (
    <motion.span
      aria-hidden
      className="absolute -ml-1.5 -mt-1.5"
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{ x, y, scale: 0.2, opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFC831" stroke="#14122E" strokeWidth="1.6">
        <path d="M12 1l2.6 7.2L22 9.3l-6 5.1 2 7.6-6-4.4-6 4.4 2-7.6-6-5.1 7.4-1.1z" />
      </svg>
    </motion.span>
  );
}

/** 插画悬浮微组件（±10px / 4s 循环，armory.md §3；memo 隔离永恒动画） */
const FloatingWeaponImg = memo(function FloatingWeaponImg({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <motion.img
      src={src}
      alt={alt}
      draggable={false}
      onClick={onClick}
      className={className}
      animate={{ y: [-10, 10, -10] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
});

function MuzzleFlash() {
  return (
    <motion.span
      aria-hidden
      className="absolute -ml-4 -mt-4"
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: [0, 1.4, 0.2], opacity: [1, 1, 0] }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#FFD65C" stroke="#14122E" strokeWidth="1.4">
        <path d="M12 0l2.2 7.1L22 5.6l-5.7 4.9L21 17l-7.3-1.5L12 23l-1.7-7.5L3 17l4.7-6.5L2 5.6l7.8 1.5z" />
      </svg>
    </motion.span>
  );
}

/* ------------------------------------------------------------------ */
/* 舞台入场 variants                                                     */
/* ------------------------------------------------------------------ */

const stageVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_BOUNCE } },
};
const illuVariants: Variants = {
  hidden: { opacity: 0, scale: 0.7, rotate: -6 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.4, ease: EASE_BOUNCE } },
};

/* ------------------------------------------------------------------ */
/* WeaponStage                                                           */
/* ------------------------------------------------------------------ */

export default function WeaponStage({
  selected,
  onSelect,
}: {
  selected: WeaponId;
  onSelect: (id: WeaponId) => void;
}) {
  const weapon = WEAPONS[selected];
  const bars = weaponBars(weapon);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [bursts, setBursts] = useState<number[]>([]);
  const burstId = useRef(0);

  /** 试射彩蛋：星形枪口闪光 + 对应枪声 */
  const fire = () => {
    audio.unlock();
    audio.playShot(selected);
    const id = ++burstId.current;
    setBursts((b) => [...b, id]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 500);
  };

  /** ↑↓ / ←→ 在 Tab 间循环切换 */
  const onTabListKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const idx = WEAPON_ORDER.indexOf(selected);
    const next = WEAPON_ORDER[(idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    onSelect(next);
    tabRefs.current[WEAPON_ORDER.indexOf(next)]?.focus();
  };

  const dpsChips: { label: string; value: string; num?: boolean }[] = [
    { label: '理论 DPS', value: `${Math.round(theoreticalDps(weapon))}`, num: true },
    { label: '秒杀枪数', value: `${shotsToKill(weapon)} 枪`, num: true },
    { label: '换弹时间', value: `${reloadSeconds(weapon).toFixed(1)}s`, num: true },
    { label: '获取方式', value: obtainMethod(weapon) },
  ];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ============ 武器选择列（Tabs） ============ */}
      <div
        role="tablist"
        aria-label="选择武器"
        aria-orientation="vertical"
        onKeyDown={onTabListKeyDown}
        className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 lg:mx-0 lg:w-56 lg:shrink-0 lg:snap-none lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {WEAPON_ORDER.map((id, i) => {
          const w = WEAPONS[id];
          const active = id === selected;
          return (
            <motion.button
              key={id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              type="button"
              onClick={() => {
                if (!active) audio.playUiClick();
                onSelect(id);
              }}
              onMouseEnter={() => {
                if (!active) audio.playUiHover();
              }}
              whileHover={active ? undefined : { x: 6 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'relative flex h-16 w-44 shrink-0 snap-start items-center gap-3 rounded-2xl border-[3px] px-4 text-left transition-colors duration-150 lg:h-20 lg:w-full',
                active
                  ? 'border-ink text-ink shadow-btn'
                  : 'border-transparent bg-bg-panel text-txt-mute hover:text-txt',
              )}
              style={active ? { backgroundColor: w.color } : undefined}
            >
              <img src={w.image} alt="" draggable={false} className="h-10 w-auto shrink-0 lg:h-12" />
              <span className="min-w-0">
                <span className="block font-head text-[22px] leading-tight">{w.name}</span>
                <span
                  className="block font-num text-xs"
                  style={active ? { color: '#14122E' } : { color: w.color }}
                >
                  {w.nameEn}
                </span>
              </span>
              {active ? (
                <motion.span
                  aria-hidden
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.2 }}
                  className="absolute -right-2 top-1/2 hidden h-10 w-1 -translate-y-1/2 rounded-full lg:block"
                  style={{ backgroundColor: w.color, boxShadow: `0 0 12px ${w.color}` }}
                />
              ) : null}
            </motion.button>
          );
        })}
      </div>

      {/* ============ 武器详情台 ============ */}
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32, transition: { duration: 0.15 } }}
            transition={{ duration: 0.3, ease: EASE_SNAP }}
          >
            <ArenaPanel contentClassName="p-6 lg:p-10">
              <motion.div variants={stageVariants} initial="hidden" animate="show">
                {/* 上段：插画台 + 名称定位 */}
                <div className="grid items-center gap-8 lg:grid-cols-[5fr_7fr]">
                  {/* 插画台 */}
                  <motion.div variants={illuVariants} className="relative flex flex-col items-center">
                    <motion.div
                      whileHover={{ scale: 1.06 }}
                      transition={{ duration: 0.15 }}
                      className="group relative flex h-52 w-full items-center justify-center lg:h-72"
                    >
                      {/* 发光圆盘（hover 增强） */}
                      <div
                        aria-hidden
                        className="absolute h-44 w-44 rounded-full opacity-75 transition-opacity duration-200 group-hover:opacity-100 lg:h-60 lg:w-60"
                        style={{
                          background: `radial-gradient(circle, ${weapon.color}40 0%, transparent 70%)`,
                        }}
                      />
                      {/* 虚线圆环（20s 线性旋转） */}
                      <svg
                        aria-hidden
                        viewBox="0 0 100 100"
                        className="animate-spin absolute h-48 w-48 opacity-40 [animation-duration:20s] lg:h-64 lg:w-64"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke={weapon.color}
                          strokeWidth="1.6"
                          strokeDasharray="6 8"
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* 武器插画（点击试射） */}
                      <FloatingWeaponImg
                        src={weapon.image}
                        alt={`${weapon.name}插画`}
                        onClick={fire}
                        className="relative z-10 h-40 w-auto cursor-pointer lg:h-56"
                      />
                      {/* 枪口试射粒子（右侧枪口位置） */}
                      {bursts.map((id) => (
                        <span key={id} aria-hidden className="absolute right-[12%] top-[42%] z-20">
                          <MuzzleFlash />
                          {SPARK_DIRS.map((d, i) => (
                            <Spark key={i} x={d.x} y={d.y} />
                          ))}
                        </span>
                      ))}
                    </motion.div>
                    <ArenaButton
                      size="sm"
                      variant="ghost"
                      sound={false}
                      onClick={fire}
                      icon={<Crosshair size={16} strokeWidth={2.6} />}
                      className="mt-4"
                    >
                      试射一发
                    </ArenaButton>
                    <p className="mt-2 text-[13px] text-txt-dim">点击插画也能试射</p>
                  </motion.div>

                  {/* 名称 + 定位 + 标签 */}
                  <div>
                    <motion.h2
                      variants={itemVariants}
                      className="font-display text-[clamp(36px,5vw,56px)] leading-[1.15] tracking-[0.02em] text-txt text-stroke-ink"
                    >
                      {weapon.name}
                    </motion.h2>
                    <motion.p
                      variants={itemVariants}
                      className="mt-1 font-num text-lg tracking-wide"
                      style={{ color: weapon.color }}
                    >
                      {weapon.nameEn}
                    </motion.p>
                    <motion.p variants={itemVariants} className="mt-3 text-lg leading-relaxed text-txt-mute">
                      {weapon.tagline}
                    </motion.p>
                    <motion.div variants={itemVariants} className="mt-4 flex flex-wrap gap-2">
                      {WEAPON_TAGS[selected].map((tag) => (
                        <Chip key={tag} color={weapon.color}>
                          {tag}
                        </Chip>
                      ))}
                    </motion.div>
                  </div>
                </div>

                {/* 下段：能力条 */}
                <motion.div variants={itemVariants} className="mt-10 space-y-3">
                  {BAR_DEFS.map((def, i) => (
                    <StatBar
                      key={def.key}
                      label={def.label}
                      value={bars[def.key]}
                      color={weapon.color}
                      delay={0.15 + i * 0.06}
                    />
                  ))}
                </motion.div>

                {/* 实战面板 */}
                <motion.div variants={itemVariants} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {dpsChips.map((chip) => (
                    <div
                      key={chip.label}
                      className="rounded-xl border border-line-soft/60 bg-bg-panel-2/60 px-3 py-2.5 text-center"
                    >
                      <div className="text-xs text-txt-dim">{chip.label}</div>
                      <div
                        className={cn(
                          'mt-0.5 text-txt',
                          chip.num ? 'font-num text-xl' : 'text-[13px] font-medium leading-6',
                        )}
                      >
                        {chip.value}
                      </div>
                    </div>
                  ))}
                </motion.div>

                {/* 使用技巧 */}
                <motion.blockquote
                  variants={itemVariants}
                  className="mt-6 border-l-[3px] py-1 pl-4"
                  style={{ borderColor: weapon.color }}
                >
                  <span className="text-[13px] font-medium tracking-[0.04em]" style={{ color: weapon.color }}>
                    使用技巧
                  </span>
                  <p className="mt-1 leading-relaxed text-txt-mute">{WEAPON_TIPS[selected]}</p>
                </motion.blockquote>
              </motion.div>
            </ArenaPanel>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
