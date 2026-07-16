/**
 * KeyCap —— 键帽（design.md §10.10）
 * 56×56 圆角 12px、白底 3px ink 描边 + 0 4px 0 ink 硬阴影、Bungee 18px 深字；
 * pulse 时播放「按下」微动效（可用 pulseDelay 错相）。
 */

import { cn } from '@/lib/utils';

export interface KeyCapProps {
  label: string;
  /** 播放两轮按下动效后静止 */
  pulse?: boolean;
  /** 动效错相（毫秒） */
  pulseDelay?: number;
  /** 小号 40×40 */
  small?: boolean;
  className?: string;
}

export default function KeyCap({ label, pulse, pulseDelay = 0, small, className }: KeyCapProps) {
  return (
    <span
      className={cn(
        'grid select-none place-items-center rounded-xl border-[3px] border-ink bg-white font-num text-ink shadow-keycap',
        small ? 'h-10 w-10 text-sm' : 'h-14 w-14 text-lg',
        pulse && 'animate-key-press',
        className,
      )}
      style={pulse ? { animationDelay: `${pulseDelay}ms` } : undefined}
    >
      {label}
    </span>
  );
}
