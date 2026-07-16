/**
 * StatBar —— 能力条（design.md §10.3）
 * 轨道 h-3 圆角 999px bg-deep + 1px line-soft；
 * 填充：语义色渐变 + 右侧高光点；入场 width 0→N%（600ms ease-snap，可 stagger）。
 * 值域 0–100。
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface StatBarProps {
  /** 0–100 */
  value: number;
  /** 语义色（填充） */
  color: string;
  /** 可选左侧标签 */
  label?: string;
  /** 入场延迟（stagger 用，秒） */
  delay?: number;
  className?: string;
}

export default function StatBar({ value, color, label, delay = 0, className }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label ? (
        <span className="w-12 shrink-0 text-[13px] font-medium text-txt-mute">{label}</span>
      ) : null}
      <div className="relative h-3 flex-1 overflow-hidden rounded-full border border-line-soft bg-bg-deep">
        <motion.div
          className="relative h-full rounded-full"
          style={{
            background: `linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%), ${color}`,
          }}
          initial={{ width: '0%' }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            aria-hidden
            className="absolute right-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/80"
          />
        </motion.div>
      </div>
    </div>
  );
}
