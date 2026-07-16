/**
 * VictoryBanner —— 胜负横幅区（results.md §2）
 * 三态：冠军「胜利！」（金 + 光晕 + 奖杯）/ 惜败（2–3 名，降饱和奖杯）/ 战败（4 名+，无奖杯）
 * GSAP 时间线：奖杯弹入 → 大字砸下 + 闪光扫过 → 名次芯片 → 战况句（useGSAP 自动清理）。
 */

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from '@/lib/utils';
import type { RankedEntry } from './resultsData';

gsap.registerPlugin(useGSAP);

export interface VictoryBannerProps {
  player: RankedEntry;
  total: number;
  verdict: string;
}

export default function VictoryBanner({ player, total, verdict }: VictoryBannerProps) {
  const scope = useRef<HTMLDivElement>(null);
  const rank = player.rank;
  const isChampion = rank === 1;
  const isClose = rank >= 2 && rank <= 3;
  const showTrophy = rank <= 3;

  useGSAP(
    () => {
      const q = gsap.utils.selector(scope);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        gsap.set(q('.vb-anim'), { opacity: 1 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: 'back.out(1.7)' } });
      if (q('.vb-trophy').length) {
        tl.fromTo(
          q('.vb-trophy'),
          { scale: 0, rotate: -8, opacity: 0 },
          { scale: 1, rotate: 0, opacity: 1, duration: 0.5 },
          0,
        );
      }
      tl.fromTo(
        q('.vb-title'),
        { scale: 2.4, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45 },
        0.15,
      );
      if (q('.vb-flash').length) {
        tl.fromTo(
          q('.vb-flash'),
          { xPercent: -120, opacity: 1 },
          { xPercent: 520, opacity: 1, duration: 0.55, ease: 'power2.inOut' },
          0.32,
        );
      }
      if (q('.vb-sub').length) {
        tl.fromTo(q('.vb-sub'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.32);
      }
      tl.fromTo(
        q('.vb-rank'),
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' },
        0.4,
      ).fromTo(q('.vb-verdict'), { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0.55);
    },
    { scope },
  );

  return (
    <div ref={scope} className="relative flex flex-col items-center pt-[72px] text-center">
      {/* 金色光晕（冠军）/ 蓝光（其余） */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-10 left-1/2 h-[420px] w-[720px] max-w-[140vw] -translate-x-1/2',
        )}
        style={{
          background: isChampion
            ? 'radial-gradient(closest-side, rgba(255,200,49,0.28), transparent)'
            : 'radial-gradient(closest-side, rgba(62,166,255,0.14), transparent)',
        }}
      />

      {showTrophy ? (
        <img
          src="/trophy.svg"
          alt="奖杯"
          draggable={false}
          className="vb-trophy vb-anim relative h-32 w-32 opacity-0"
          style={{
            filter: isChampion
              ? 'drop-shadow(0 0 28px rgba(255,200,49,0.55))'
              : 'saturate(0.6)',
          }}
        />
      ) : null}

      {/* 胜负大字 + 闪光扫过 */}
      <div className="relative mt-2 overflow-hidden px-6 py-2">
        <h1
          className={cn(
            'vb-title vb-anim font-display text-[clamp(64px,9vw,120px)] leading-[1.05] tracking-[0.02em] opacity-0',
            isChampion ? 'text-yel text-stroke-ink-lg' : isClose ? 'text-txt text-stroke-ink-lg' : 'text-txt-mute text-stroke-ink',
          )}
        >
          {isChampion ? '胜利！' : isClose ? '惜败！' : '战败…'}
        </h1>
        <div
          aria-hidden
          className="vb-flash pointer-events-none absolute inset-y-0 left-0 w-1/4 opacity-0"
        >
          <div className="h-full w-full -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)]" />
        </div>
      </div>

      {!isChampion ? (
        <p className="vb-sub vb-anim mt-1 text-[13px] font-medium tracking-[0.04em] text-txt-dim opacity-0">
          {isClose ? '就差一点，枪王之位在招手' : '机器人正在偷笑，快去打回去'}
        </p>
      ) : null}

      {/* 名次芯片 */}
      <div
        className={cn(
          'vb-rank vb-anim mt-5 inline-flex h-12 items-center rounded-full border-[3px] px-6 font-num text-[28px] leading-none opacity-0',
          isChampion
            ? 'border-ink bg-yel text-ink shadow-btn'
            : 'border-line-soft bg-bg-panel-2 text-txt',
        )}
      >
        #{rank} <span className="mx-2 opacity-50">/</span> {total}
      </div>

      {/* 战况一句话 */}
      <p className="vb-verdict vb-anim mt-4 text-lg leading-relaxed text-txt-mute opacity-0">
        <span className="font-num text-yel">{player.kills}</span> 杀{' '}
        <span className="font-num text-red">{player.deaths}</span> 死 · {verdict}
      </p>
    </div>
  );
}
