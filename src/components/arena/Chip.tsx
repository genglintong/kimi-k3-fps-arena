/**
 * Chip —— 信息芯片（design.md §10.5）
 * 圆角 999px、h-8、px-3、13px Noto 500，深底 + 语义色左点（●）。
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChipProps {
  /** 左侧圆点颜色（默认 yel） */
  color?: string;
  className?: string;
  children?: ReactNode;
}

export default function Chip({ color = '#FFC831', className, children }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border border-line-soft/60 bg-bg-panel-2/80 px-3 text-[13px] font-medium text-txt-mute',
        className,
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      {children}
    </span>
  );
}
