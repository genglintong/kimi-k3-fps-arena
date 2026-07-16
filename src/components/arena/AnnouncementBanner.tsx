/**
 * AnnouncementBanner —— 游戏内大字播报（design.md §10.9 / §7.2）
 * 居中偏上（顶 28%），KuaiLe 40–56px，白/黄/红填充 + ink 描边 + 16px 副标题。
 * 动效：上方 -80px 弹入（ease-bounce 350ms）→ 停留 → 上滑淡出 250ms。
 *
 * 用法：父级用 <AnimatePresence>{show && <AnnouncementBanner .../>}</AnimatePresence>
 * 控制驻留时长（推荐 1.2s）。
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type AnnouncementTone = 'white' | 'gold' | 'red' | 'gray';

export interface AnnouncementBannerProps {
  title: string;
  subtitle?: string;
  tone?: AnnouncementTone;
  /** 覆盖默认定位（默认 fixed 顶 28% 居中，供游戏 HUD 使用） */
  className?: string;
}

const TONE_CLASSES: Record<AnnouncementTone, string> = {
  white: 'text-white',
  gold: 'text-yel',
  red: 'text-red',
  gray: 'text-txt-mute',
};

export default function AnnouncementBanner({
  title,
  subtitle,
  tone = 'white',
  className,
}: AnnouncementBannerProps) {
  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -30, opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      className={cn(
        'pointer-events-none fixed left-1/2 top-[28%] z-[80] -translate-x-1/2 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'font-display text-[clamp(40px,5vw,56px)] leading-tight text-stroke-ink',
          TONE_CLASSES[tone],
        )}
      >
        {title}
      </div>
      {subtitle ? <div className="mt-1 text-base text-txt-mute">{subtitle}</div> : null}
    </motion.div>
  );
}
