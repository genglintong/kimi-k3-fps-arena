/**
 * CountUp —— GSAP 数字滚动（design.md §7.2：snap + power2.out）
 * 独立微组件，卸载时 kill tween；reduced-motion 直接落终值。
 */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export interface CountUpProps {
  value: number;
  /** 起始延迟（秒） */
  delay?: number;
  /** 滚动时长（秒） */
  duration?: number;
  /** 小数位数（K/D 用 1） */
  decimals?: number;
  className?: string;
}

export default function CountUp({
  value,
  delay = 0,
  duration = 0.9,
  decimals = 0,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => n.toFixed(decimals);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt(value);
      return;
    }
    const state = { v: 0 };
    const tween = gsap.to(state, {
      v: value,
      delay,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = fmt(state.v);
      },
      onComplete: () => {
        el.textContent = fmt(value);
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, delay, duration, decimals]);

  return (
    <span ref={ref} className={className}>
      {(0).toFixed(decimals)}
    </span>
  );
}
