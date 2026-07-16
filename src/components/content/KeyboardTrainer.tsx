/**
 * 键位教学区（guide.md §3）——交互式键位特训：
 * - 真实监听 keydown/keyup/mousedown，点亮对应键帽（W/A/S/D、R、1-4、Esc、鼠标左键）
 * - 全部 11 键点亮后弹出「出师」横幅
 * - 未点亮前 WASD 循环演示按下动效（250ms/键 + 1.25s 停顿）
 * - 触屏设备自动跳过键盘监听；所有监听器与定时器在卸载时清理
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, PartyPopper } from 'lucide-react';
import ArenaPanel from '@/components/arena/ArenaPanel';
import KeyCap from '@/components/arena/KeyCap';
import { COLORS } from '@/game/constants';
import { audio } from '@/game/audio';
import { cn } from '@/lib/utils';
import { EASE_SNAP } from './shared';

/* ------------------------------------------------------------------ */
/* 键位模型                                                              */
/* ------------------------------------------------------------------ */

/** 计入特训进度的键（10 键 + 鼠标左键） */
const PROGRESS_KEYS = ['w', 'a', 's', 'd', 'r', '1', '2', '3', '4', 'esc', 'mouse'] as const;
const WASD = ['w', 'a', 's', 'd'] as const;

/** 键盘事件 → 内部键 id（方向键映射到 WASD） */
function mapKey(e: KeyboardEvent): string | null {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') return 'w';
  if (k === 'a' || k === 'arrowleft') return 'a';
  if (k === 's' || k === 'arrowdown') return 's';
  if (k === 'd' || k === 'arrowright') return 'd';
  if (k === 'r') return 'r';
  if (k === 'm') return 'm';
  if (k === '1' || k === '2' || k === '3' || k === '4') return k;
  if (k === 'escape') return 'esc';
  return null;
}

/* ------------------------------------------------------------------ */
/* 单个特训键帽                                                          */
/* ------------------------------------------------------------------ */

function TrainerKey({
  label,
  tip,
  small,
  wide,
  lit,
  demo,
  down,
}: {
  label: string;
  tip: string;
  small?: boolean;
  wide?: boolean;
  lit: boolean;
  demo?: boolean;
  down?: boolean;
}) {
  return (
    <span className="group relative inline-flex">
      <KeyCap
        label={label}
        small={small}
        className={cn(
          'transition-colors duration-150',
          small && 'h-11 w-11',
          wide && 'w-16',
          lit && 'bg-yel',
          demo && !lit && 'bg-yel-light',
          (demo || down) && 'translate-y-[3px] !shadow-[0_1px_0_#14122E]',
        )}
      />
      {lit ? (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
          className="absolute -right-1.5 -top-1.5 z-10 grid h-4 w-4 place-items-center rounded-full border-2 border-ink bg-grn text-ink"
        >
          <Check size={9} strokeWidth={4} />
        </motion.span>
      ) : null}
      {/* hover tooltip */}
      <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-soft bg-bg-deep px-2 py-1 text-[13px] text-txt opacity-0 shadow-panel transition-opacity duration-150 group-hover:opacity-100">
        {tip}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 鼠标线稿                                                              */
/* ------------------------------------------------------------------ */

function MouseSketch({ lit, down }: { lit: boolean; down: boolean }) {
  return (
    <svg width="96" height="128" viewBox="0 0 72 96" fill="none" aria-hidden>
      <rect x="10" y="6" width="52" height="84" rx="26" stroke="#fff" strokeWidth="4" />
      <path d="M36 6v30" stroke="#fff" strokeWidth="4" />
      <path d="M10 36h52" stroke="#fff" strokeWidth="4" />
      {/* 左键（红色高亮，点亮后常驻） */}
      <path
        d="M12 34V30A24 24 0 0 1 34 7.2V34z"
        fill="#FF5A5F"
        opacity={lit ? 1 : 0.55}
        className="transition-opacity duration-200"
      />
      {/* 滚轮 */}
      <rect x="33" y="14" width="6" height="12" rx="3" fill="#FFC831" stroke="#14122E" strokeWidth="1.6" />
      {/* 左键闪烁提示点 / 按下反馈 */}
      <circle
        cx="23"
        cy="20"
        r={down ? 6 : 4}
        fill="#fff"
        className={lit ? undefined : 'animate-dot-blink'}
        style={{ transition: 'r 120ms' }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 键位总表                                                              */
/* ------------------------------------------------------------------ */

const BINDINGS: { keys: string; action: string }[] = [
  { keys: 'W / A / S / D 或方向键', action: '移动' },
  { keys: '鼠标', action: '瞄准' },
  { keys: '左键', action: '射击（按住连发）' },
  { keys: 'R', action: '换弹' },
  { keys: '1–4 / 滚轮', action: '切换武器' },
  { keys: 'Esc', action: '暂停' },
  { keys: 'M', action: '静音' },
];

/* ------------------------------------------------------------------ */
/* KeyboardTrainer                                                       */
/* ------------------------------------------------------------------ */

export default function KeyboardTrainer() {
  const [lit, setLit] = useState<ReadonlySet<string>>(() => new Set());
  const [down, setDown] = useState<ReadonlySet<string>>(() => new Set());
  const [demoTick, setDemoTick] = useState(0);
  const celebrated = useRef(false);

  const coarse = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    [],
  );
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  /* 真实键盘 / 鼠标监听（触屏设备跳过；卸载时清理） */
  useEffect(() => {
    if (coarse) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const id = mapKey(e);
      if (!id) return;
      setLit((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      setDown((prev) => new Set(prev).add(id));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const id = mapKey(e);
      if (!id) return;
      setDown((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setLit((prev) => (prev.has('mouse') ? prev : new Set(prev).add('mouse')));
      setDown((prev) => new Set(prev).add('mouse'));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setDown((prev) => {
        const next = new Set(prev);
        next.delete('mouse');
        return next;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [coarse]);

  const wasdDone = WASD.every((k) => lit.has(k));

  /* WASD 循环演示（未全部点亮前；卸载时清理定时器） */
  useEffect(() => {
    if (coarse || reduced || wasdDone) return;
    const timer = window.setInterval(() => setDemoTick((t) => t + 1), 250);
    return () => window.clearInterval(timer);
  }, [coarse, reduced, wasdDone]);

  /** 每轮 9 拍：前 4 拍依次按 W/A/S/D，后 5 拍停顿 */
  const demoKey = wasdDone ? null : demoTick % 9 < 4 ? WASD[demoTick % 9] : null;

  const litCount = PROGRESS_KEYS.filter((k) => lit.has(k)).length;
  const complete = litCount === PROGRESS_KEYS.length;
  const pct = Math.round((litCount / PROGRESS_KEYS.length) * 100);

  /* 全部点亮：庆祝音（仅一次） */
  useEffect(() => {
    if (complete && !celebrated.current) {
      celebrated.current = true;
      audio.playConfirm();
    }
  }, [complete]);

  const keyState = (id: string) => ({
    lit: lit.has(id),
    down: down.has(id),
    demo: demoKey === id,
  });

  return (
    <ArenaPanel contentClassName="p-6 lg:p-10">
      {/* 头部：标题 + 进度 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h3 className="font-head text-[26px] text-txt">键位特训 · 按亮它们</h3>
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <div className="relative h-3 flex-1 overflow-hidden rounded-full border border-line-soft bg-bg-deep">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%), ${
                  complete ? COLORS.grn : COLORS.yel
                }`,
              }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3, ease: EASE_SNAP }}
            />
          </div>
          <span className="font-num text-sm text-yel">
            {litCount}/{PROGRESS_KEYS.length}
          </span>
        </div>
        <p className="w-full text-[13px] text-txt-dim sm:w-auto">
          {coarse ? '触屏设备先看看键位表，到桌面来实战练习！' : '按按你的键盘和鼠标，把 11 个键位全部点亮'}
        </p>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr]">
        {/* 左：键盘 */}
        <div>
          <p className="mb-4 text-[13px] font-medium tracking-[0.04em] text-txt-dim">键盘</p>
          <div className="flex flex-wrap items-start gap-x-12 gap-y-8">
            {/* WASD 集群 */}
            <div>
              <div className="grid w-fit grid-cols-3 gap-2">
                <span />
                <TrainerKey label="W" tip="向前移动" {...keyState('w')} />
                <span />
                <TrainerKey label="A" tip="向左移动" {...keyState('a')} />
                <TrainerKey label="S" tip="向后移动" {...keyState('s')} />
                <TrainerKey label="D" tip="向右移动" {...keyState('d')} />
              </div>
              <p className="mt-3 text-[13px] text-txt-dim">移动（方向键也行）</p>
            </div>

            {/* 功能键 */}
            <div className="space-y-5">
              <div>
                <div className="flex gap-2">
                  {(['1', '2', '3', '4'] as const).map((n) => (
                    <TrainerKey
                      key={n}
                      label={n}
                      small
                      tip={`切换到 ${n} 号武器位`}
                      {...keyState(n)}
                      demo={false}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-txt-dim">切换武器（滚轮也行）</p>
              </div>
              <div className="flex items-start gap-5">
                <span className="flex flex-col items-start gap-3">
                  <TrainerKey label="R" small tip="换弹匣" {...keyState('r')} />
                  <span className="text-[13px] text-txt-dim">换弹</span>
                </span>
                <span className="flex flex-col items-start gap-3">
                  <TrainerKey label="Esc" small wide tip="暂停 / 设置" {...keyState('esc')} />
                  <span className="text-[13px] text-txt-dim">暂停</span>
                </span>
                <span className="flex flex-col items-start gap-3">
                  <TrainerKey label="M" small tip="静音开关" lit={lit.has('m')} down={down.has('m')} />
                  <span className="text-[13px] text-txt-dim">静音</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 右：鼠标 */}
        <div className="lg:border-l lg:border-line-soft/50 lg:pl-10">
          <p className="mb-4 text-[13px] font-medium tracking-[0.04em] text-txt-dim">鼠标</p>
          <div className="flex items-center gap-6">
            <MouseSketch lit={lit.has('mouse')} down={down.has('mouse')} />
            <ul className="space-y-3 text-[13px] leading-relaxed text-txt-mute">
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-red" />
                <span>
                  左键 · 开火（按住连发）
                  {lit.has('mouse') ? <Check size={13} className="ml-1 inline text-grn" /> : null}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-yel" />
                滚轮 · 切换武器
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-blu" />
                移动 · 瞄准方向
              </li>
            </ul>
          </div>
          <p className="mt-4 text-[13px] text-txt-dim">在页面任意处点一下左键试试 ↑</p>
        </div>
      </div>

      {/* 出师横幅 */}
      <AnimatePresence>
        {complete ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_SNAP }}
            className="overflow-hidden"
          >
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border-2 border-grn bg-grn/15 px-4 py-3">
              <PartyPopper size={18} className="text-grn" />
              <span className="font-head text-xl text-grn">全部点亮，出师了！</span>
              <span className="hidden text-[13px] text-txt-mute sm:inline">手感已就位，去实战里乱杀吧。</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 键位总表 */}
      <div className="mt-8 border-t border-line-soft/40 pt-6">
        <p className="mb-3 text-[13px] font-medium tracking-[0.04em] text-txt-dim">键位总表</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {BINDINGS.map((b) => (
            <div
              key={b.keys}
              className="flex items-center justify-between gap-2 rounded-xl border border-line-soft/50 bg-bg-panel-2/60 px-3 py-2"
            >
              <span className="font-num text-[13px] text-txt">{b.keys}</span>
              <span className="text-[13px] text-txt-mute">{b.action}</span>
            </div>
          ))}
        </div>
      </div>
    </ArenaPanel>
  );
}
