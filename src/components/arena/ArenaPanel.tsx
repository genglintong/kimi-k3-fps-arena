/**
 * ArenaPanel —— 厚边面板（design.md §10.2）
 * bg-panel + 圆角 20px + 2px 亮描边 + 顶部内高光 + 0 12px 32px 投影。
 * colorBar：可选顶部色条（h-2 圆角色带）。
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ArenaPanelProps {
  /** 顶部色条颜色（CSS 颜色值） */
  colorBar?: string;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
  onClick?: () => void;
}

export default function ArenaPanel({
  colorBar,
  className,
  contentClassName,
  children,
  onClick,
}: ArenaPanelProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-[20px] border-2 border-white/[0.08] bg-bg-panel panel-highlight',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {colorBar ? (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-2"
          style={{ backgroundColor: colorBar }}
        />
      ) : null}
      <div className={cn('relative', contentClassName)}>{children}</div>
    </div>
  );
}
