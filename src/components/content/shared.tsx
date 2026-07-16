/**
 * 内容页（武器库 / 玩法指南）共享块：
 * - PageHeader：H1 + 副标 + 「直接开战」按钮，入场 stagger（armory.md §1 / guide.md §1）
 * - CtaSection：底部 CTA 条（逐词上浮 + 呼吸按钮 + 圆形扩散转场 /play）
 * - useWarpToPlay：圆形扩散转场 hook（design.md §7.2）
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import ArenaButton from '@/components/arena/ArenaButton';
import { audio } from '@/game/audio';

export const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as [number, number, number, number];
export const EASE_SNAP = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ------------------------------------------------------------------ */
/* 圆形扩散转场                                                          */
/* ------------------------------------------------------------------ */

export function useWarpToPlay() {
  const navigate = useNavigate();
  const [warp, setWarp] = useState<{ x: number; y: number } | null>(null);

  const start = (e: React.MouseEvent) => {
    audio.unlock();
    audio.playConfirm();
    setWarp({ x: e.clientX, y: e.clientY });
  };

  const overlay = warp ? (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[99] rounded-full bg-yel"
      style={{ left: warp.x - 40, top: warp.y - 40, width: 80, height: 80 }}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 45 }}
      transition={{ duration: 0.6, ease: EASE_SNAP }}
      onAnimationComplete={() => navigate('/play')}
    />
  ) : null;

  return { start, overlay };
}

/* ------------------------------------------------------------------ */
/* 页头                                                                 */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
      <div>
        <motion.h1
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE_SNAP }}
          className="font-display text-[clamp(40px,6vw,56px)] leading-[1.15] tracking-[0.02em] text-txt text-stroke-ink"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15, ease: EASE_SNAP }}
          className="mt-2 text-lg leading-relaxed text-txt-mute"
        >
          {subtitle}
        </motion.p>
      </div>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3, ease: EASE_BOUNCE }}
      >
        <ArenaButton to="/play" size="md">
          直接开战 →
        </ArenaButton>
      </motion.div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* 区块标题                                                              */
/* ------------------------------------------------------------------ */

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <motion.div
      initial={{ y: 32, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: EASE_SNAP }}
      className="text-center"
    >
      <h2 className="font-head text-[clamp(28px,3.6vw,40px)] tracking-[0.03em] text-txt">{title}</h2>
      {sub ? <p className="mt-2 text-[13px] font-medium tracking-[0.04em] text-txt-mute">{sub}</p> : null}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 底部 CTA 条                                                           */
/* ------------------------------------------------------------------ */

export function CtaSection({
  words,
  size,
  primaryLabel = '开始战斗',
  ghostLabel,
}: {
  /** 逐词上浮的标题词组 */
  words: string[];
  size: 'lg' | 'xl';
  primaryLabel?: string;
  ghostLabel: string;
}) {
  const { start, overlay } = useWarpToPlay();

  return (
    <section className="py-8 text-center">
      {overlay}
      <h2 className="font-head text-[clamp(30px,4vw,44px)] tracking-[0.03em] text-txt">
        {words.map((w, i) => (
          <motion.span
            key={i}
            initial={{ y: 28, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.4, delay: i * 0.12, ease: EASE_BOUNCE }}
            className="mr-3 inline-block last:mr-0"
          >
            {w}
          </motion.span>
        ))}
      </h2>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.45, delay: 0.25, ease: EASE_BOUNCE }}
        className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
      >
        <ArenaButton
          size={size}
          sound={false}
          onClick={start}
          className="animate-cta-breathe w-full sm:w-auto"
          icon={<Crosshair size={size === 'xl' ? 30 : 24} strokeWidth={2.6} />}
        >
          {primaryLabel}
        </ArenaButton>
        <ArenaButton to="/" variant="ghost" size="md" className="w-full sm:w-auto">
          {ghostLabel}
        </ArenaButton>
      </motion.div>
    </section>
  );
}
