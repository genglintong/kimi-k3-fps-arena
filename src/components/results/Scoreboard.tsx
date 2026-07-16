/**
 * Scoreboard —— 积分榜面板（results.md §3）
 * 按击杀排序（并列 → 死亡少 → 伤害高）；玩家行高亮 + 冠军行金框呼吸。
 * 行入场：framer-motion stagger（layout="position" 提供 FLIP 重排动画）；
 * 击杀数字：GSAP count-up（CountUp 组件，与行 stagger 同步）。
 * 移动端保留 4 列核心（名次/玩家/击杀/死亡），K/D 与伤害 sm 起显示。
 */

import { motion } from 'framer-motion';
import { Medal, Star } from 'lucide-react';
import ArenaPanel from '@/components/arena/ArenaPanel';
import PlayerBadge from '@/components/arena/PlayerBadge';
import type { BadgeFace } from '@/components/arena/PlayerBadge';
import CountUp from './CountUp';
import { kdOf } from './resultsData';
import type { RankedEntry } from './resultsData';
import { cn } from '@/lib/utils';

const EASE_SNAP = [0.22, 1, 0.36, 1] as [number, number, number, number];

const RANK_COLORS = ['#FFC831', '#C7CEEA', '#D99A6C'];

const GRID_COLS =
  'grid-cols-[2.75rem_minmax(0,1fr)_3.5rem_3.5rem] sm:grid-cols-[3rem_minmax(0,1fr)_4.25rem_4.25rem_4rem_5rem]';

function faceFor(entry: RankedEntry): BadgeFace {
  if (entry.rank === 1) return 'cool';
  if (entry.isPlayer && entry.rank >= 4) return 'worried';
  return 'smile';
}

export interface ScoreboardProps {
  ranked: RankedEntry[];
  durationS: number;
  overtime: boolean;
}

export default function Scoreboard({ ranked, durationS, overtime }: ScoreboardProps) {
  const maxDamage = Math.max(...ranked.map((e) => e.damage));

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7, ease: EASE_SNAP }}
      className="mt-12"
      aria-label="积分榜"
    >
      <ArenaPanel colorBar="#FFC831" contentClassName="p-5 sm:p-8">
        {/* 标题行 */}
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-head text-[32px] leading-none tracking-[0.03em] text-txt sm:text-[40px]">
            积分榜
          </h2>
          <p className="pb-1 text-[13px] font-medium tracking-[0.04em] text-txt-dim">
            {Math.max(1, Math.round(durationS / 60))} 分钟 · 击杀计分
            {overtime ? ' · 加时' : ''}
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[300px]">
            {/* 表头 */}
            <div
              className={cn(
                'grid items-center gap-2 border-b border-line-soft/60 px-3 pb-2',
                GRID_COLS,
              )}
            >
              <span className="text-[13px] font-medium text-txt-dim">名次</span>
              <span className="text-[13px] font-medium text-txt-dim">玩家</span>
              <span className="text-right text-[13px] font-medium text-txt-dim">击杀</span>
              <span className="text-right text-[13px] font-medium text-txt-dim">死亡</span>
              <span className="hidden text-right text-[13px] font-medium text-txt-dim sm:block">
                K/D
              </span>
              <span className="hidden text-right text-[13px] font-medium text-txt-dim sm:block">
                伤害
              </span>
            </div>

            {/* 数据行 */}
            <div className="mt-2 space-y-1.5">
              {ranked.map((e, i) => {
                const isChampion = e.rank === 1;
                const isTopDamage = e.damage === maxDamage && maxDamage > 0;
                return (
                  <motion.div
                    key={e.id}
                    layout="position"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.85 + i * 0.08, ease: EASE_SNAP }}
                    className={cn(
                      'relative grid h-14 items-center gap-2 rounded-xl px-3 transition-colors duration-120',
                      GRID_COLS,
                      e.isPlayer && 'bg-bg-panel-2 shadow-[inset_3px_0_0_#FFC831]',
                      isChampion &&
                        'border border-[rgba(255,200,49,0.45)] bg-[linear-gradient(90deg,rgba(255,200,49,0.14),transparent)]',
                      !e.isPlayer && !isChampion && 'hover:bg-bg-panel-2/70',
                    )}
                  >
                    {/* 冠军行金光呼吸 */}
                    {isChampion ? (
                      <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(90deg,rgba(255,200,49,0.12),transparent)]"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ) : null}

                    {/* 名次 */}
                    <span className="relative flex items-center gap-1.5">
                      {e.rank <= 3 ? (
                        <Medal
                          size={14}
                          color={RANK_COLORS[e.rank - 1]}
                          strokeWidth={2.6}
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className="font-num text-[20px] leading-none"
                        style={{ color: RANK_COLORS[e.rank - 1] ?? '#6E74B8' }}
                      >
                        {e.rank}
                      </span>
                    </span>

                    {/* 玩家 */}
                    <span className="relative flex min-w-0 items-center gap-2">
                      <PlayerBadge
                        avatarOnly
                        size={32}
                        name={e.name}
                        color={e.color}
                        face={faceFor(e)}
                      />
                      <span className="truncate text-[14px] font-medium text-txt">
                        {e.name}
                      </span>
                      {e.isPlayer ? (
                        <span className="shrink-0 rounded-full border-2 border-ink bg-yel px-1.5 font-head text-[11px] leading-4 text-ink">
                          你
                        </span>
                      ) : null}
                    </span>

                    {/* 击杀 */}
                    <span className="relative text-right">
                      <CountUp
                        value={e.kills}
                        delay={0.85 + i * 0.08}
                        duration={0.6}
                        className="font-num text-[20px] leading-none text-yel"
                      />
                    </span>

                    {/* 死亡 */}
                    <span className="relative text-right">
                      {e.deaths === 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-num text-[20px] leading-none text-grn">
                          0
                          <Star size={12} fill="#3ED97E" color="#3ED97E" aria-hidden />
                        </span>
                      ) : (
                        <span className="font-num text-[20px] leading-none text-red">
                          {e.deaths}
                        </span>
                      )}
                    </span>

                    {/* K/D */}
                    <span className="relative hidden text-right text-[13px] font-medium text-txt sm:block">
                      {kdOf(e).toFixed(1)}
                    </span>

                    {/* 伤害 */}
                    <span className="relative hidden text-right text-[13px] text-txt-mute sm:block">
                      <span
                        className={cn(
                          isTopDamage &&
                            'underline decoration-blu decoration-2 underline-offset-4',
                        )}
                      >
                        {e.damage}
                      </span>
                      {isTopDamage ? (
                        <span className="ml-1 rounded bg-blu/20 px-1 text-[10px] font-medium text-blu">
                          最高
                        </span>
                      ) : null}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </ArenaPanel>
    </motion.section>
  );
}
