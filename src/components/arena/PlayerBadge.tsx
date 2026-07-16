/**
 * PlayerBadge —— 玩家徽章（design.md §10.4）
 * 圆形头像（色底 + 白色 Q 版表情脸 SVG）+ 名字（13px）+ 可选击杀数芯片。
 */

import { cn } from '@/lib/utils';

export type BadgeFace = 'smile' | 'cool' | 'dead' | 'worried';

export interface PlayerBadgeProps {
  name: string;
  /** 角色色 */
  color: string;
  /** 头像尺寸（默认 40） */
  size?: 40 | 48 | 32;
  face?: BadgeFace;
  /** 可选击杀数芯片 */
  kills?: number;
  className?: string;
  /** 只显示头像 */
  avatarOnly?: boolean;
}

function Face({ face }: { face: BadgeFace }) {
  if (face === 'dead') {
    return (
      <g stroke="#14122E" strokeWidth="2.4" strokeLinecap="round">
        <path d="M14 18 l6 6 M20 18 l-6 6" />
        <path d="M28 18 l6 6 M34 18 l-6 6" />
        <path d="M18 34 q3 -3 6 0 q3 3 6 0" fill="none" />
      </g>
    );
  }
  if (face === 'cool') {
    return (
      <g>
        <rect x="11" y="15" width="12" height="6" rx="3" fill="#14122E" />
        <rect x="25" y="15" width="12" height="6" rx="3" fill="#14122E" />
        <rect x="21" y="17" width="6" height="2.4" fill="#14122E" />
        <path d="M18 32 q6 5 12 0" stroke="#14122E" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (face === 'worried') {
    return (
      <g>
        <circle cx="16" cy="18" r="3.4" fill="#fff" />
        <circle cx="32" cy="18" r="3.4" fill="#fff" />
        <circle cx="16.8" cy="18.8" r="1.7" fill="#14122E" />
        <circle cx="32.8" cy="18.8" r="1.7" fill="#14122E" />
        <path d="M18 33 q3 -3 6 0 q3 3 6 0" stroke="#14122E" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  // smile
  return (
    <g>
      <circle cx="16" cy="18" r="4" fill="#fff" />
      <circle cx="32" cy="18" r="4" fill="#fff" />
      <circle cx="17" cy="19" r="2" fill="#14122E" />
      <circle cx="33" cy="19" r="2" fill="#14122E" />
      <path d="M16 29 q8 8 16 0" stroke="#14122E" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="26" r="2.4" fill="rgba(255,255,255,0.45)" />
      <circle cx="38" cy="26" r="2.4" fill="rgba(255,255,255,0.45)" />
    </g>
  );
}

export default function PlayerBadge({
  name,
  color,
  size = 40,
  face = 'smile',
  kills,
  className,
  avatarOnly,
}: PlayerBadgeProps) {
  const avatar = (
    <span
      aria-hidden
      className="relative inline-grid shrink-0 place-items-center rounded-full border-[3px] border-ink"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <svg viewBox="0 0 48 48" width={size * 0.86} height={size * 0.86}>
        <Face face={face} />
      </svg>
    </span>
  );

  if (avatarOnly) return avatar;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {avatar}
      <span className="text-[13px] font-medium text-txt">{name}</span>
      {kills !== undefined ? (
        <span className="rounded-full border-2 border-ink bg-yel px-1.5 font-num text-[11px] leading-4 text-ink">
          {kills}
        </span>
      ) : null}
    </span>
  );
}
