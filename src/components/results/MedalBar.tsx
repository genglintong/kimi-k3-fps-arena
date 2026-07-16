/**
 * MedalBar —— 勋章条（results.md §5）
 * 最多 3 枚；徽章 64px 圆形（色底 + ink 描边 + 白色图标）+ 名称 + hover tooltip。
 * 入场：stagger scale 0→1 + rotate -180→0（ease-bounce，1.6s 起），逐枚"叮"音。
 * 0 枚时显示鼓励文案。
 */

import { motion } from 'framer-motion';
import { audio } from '@/game/audio';
import type { Medal } from './resultsData';

const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

export interface MedalBarProps {
  medals: Medal[];
}

export default function MedalBar({ medals }: MedalBarProps) {
  return (
    <section aria-label="本局勋章" className="mt-10 flex flex-col items-center">
      <h3 className="font-head text-[22px] tracking-[0.03em] text-txt-mute">本局勋章</h3>
      {medals.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.35 }}
          className="mt-4 text-[13px] font-medium tracking-[0.04em] text-txt-dim"
        >
          本局暂无勋章，下局加油
        </motion.p>
      ) : (
        <div className="mt-5 flex flex-wrap items-start justify-center gap-6">
          {medals.map((medal, i) => {
            const Icon = medal.icon;
            return (
              <motion.div
                key={medal.id}
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, delay: 1.6 + i * 0.12, ease: EASE_BOUNCE }}
                onAnimationStart={() => audio.playUiHover()}
                className="group relative flex w-24 flex-col items-center"
              >
                {/* tooltip */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 translate-y-2 rounded-lg border border-line-soft bg-bg-deep px-3 py-1.5 text-center text-[12px] leading-snug text-txt-mute opacity-0 shadow-panel transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100"
                >
                  {medal.desc}
                </span>
                <span
                  aria-hidden
                  className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-ink"
                  style={{ backgroundColor: medal.color, boxShadow: `0 0 20px ${medal.color}55` }}
                >
                  <Icon size={28} color="#FFFFFF" strokeWidth={2.4} />
                </span>
                <span className="mt-2 text-[13px] font-medium text-txt">{medal.name}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
