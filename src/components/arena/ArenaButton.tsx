/**
 * ArenaButton —— 卡通 3D 按钮（design.md §10.1）
 * 圆角 14px、3px ink 描边、硬阴影 0 6px 0 ink；
 * hover scale(1.05) rotate(-1deg)；active 下沉 4px 阴影压缩。
 */

import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { audio } from '@/game/audio';

export type ArenaButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ArenaButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ArenaButtonProps {
  variant?: ArenaButtonVariant;
  size?: ArenaButtonSize;
  /** 传入则渲染为 react-router Link */
  to?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
  /** 是否播放 UI 点击音（默认 true；to 导航时也会播放） */
  sound?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  'aria-label'?: string;
}

const VARIANT_CLASSES: Record<ArenaButtonVariant, string> = {
  primary:
    'bg-[linear-gradient(180deg,#FFD65C_0%,#FFC831_55%,#F5B400_100%)] text-ink',
  secondary: 'bg-blu text-ink',
  danger: 'bg-red text-ink',
  ghost: 'bg-bg-panel-2/60 border-2 border-white/25 text-txt shadow-btn',
};

const SIZE_CLASSES: Record<ArenaButtonSize, string> = {
  sm: 'h-10 px-4 text-base',
  md: 'h-14 px-7 text-xl',
  lg: 'h-20 px-12 text-[28px]',
  xl: 'h-24 px-16 text-[32px]',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 select-none whitespace-nowrap rounded-[14px] border-[3px] border-ink font-head tracking-[0.06em] shadow-btn transition-all duration-120 ease-std hover:scale-105 hover:-rotate-1 active:translate-y-1 active:shadow-btn-active disabled:pointer-events-none disabled:saturate-50 disabled:shadow-none';

const ArenaButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, ArenaButtonProps>(
  function ArenaButton(
    {
      variant = 'primary',
      size = 'md',
      to,
      type = 'button',
      disabled,
      icon,
      className,
      children,
      sound = true,
      onClick,
      onMouseEnter,
      ...rest
    },
    ref,
  ) {
    const classes = cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);

    const handleClick = (e: React.MouseEvent) => {
      if (sound && !disabled) audio.playUiClick();
      onClick?.(e);
    };
    const handleEnter = (e: React.MouseEvent) => {
      if (sound && !disabled) audio.playUiHover();
      onMouseEnter?.(e);
    };

    const content = (
      <>
        {icon ? <span className="inline-flex shrink-0 items-center">{icon}</span> : null}
        {children}
      </>
    );

    if (to && !disabled) {
      return (
        <Link
          to={to}
          className={classes}
          onClick={handleClick}
          onMouseEnter={handleEnter}
          ref={ref as React.Ref<HTMLAnchorElement>}
          aria-label={rest['aria-label']}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        type={type}
        disabled={disabled}
        className={classes}
        onClick={handleClick}
        onMouseEnter={handleEnter}
        ref={ref as React.Ref<HTMLButtonElement>}
        aria-label={rest['aria-label']}
      >
        {content}
      </button>
    );
  },
);

export default ArenaButton;
