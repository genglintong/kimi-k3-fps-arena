/**
 * StatCards —— 个人数据卡 ×4（results.md §4 + 失败变体 §7 毒舌附注）
 * 卡面：击杀 / K·D 比 / 最高连杀 / 总伤害（命中率数据当局未采集，按可用数据设卡）。
 * 入场：stagger 弹入（ease-bounce，1.1s 起）；数字 GSAP count-up；hover 上浮 + 图标摇摆。
 */

import { motion } from 'framer-motion';
import { Crosshair, Flame, Skull, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ArenaPanel from '@/components/arena/ArenaPanel';
import CountUp from './CountUp';
import { kdOf } from './resultsData';
import type { RankedEntry } from './resultsData';

const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

interface CardDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  value: number;
  decimals: number;
  note: string;
}

export interface StatCardsProps {
  player: RankedEntry;
  maxDamage: number;
}

export default function StatCards({ player, maxDamage }: StatCardsProps) {
  const lost = player.rank >= 4;
  const kd = kdOf(player);
  const isTopDamage = player.damage === maxDamage && maxDamage > 0;

  const cards: CardDef[] = [
    {
      id: 'kills',
      label: '本场击杀',
      icon: Skull,
      color: '#FFC831',
      value: player.kills,
      decimals: 0,
      note:
        lost && player.kills === 0 ? '一枪未中也是种天赋' : `死亡 ${player.deaths} 次`,
    },
    {
      id: 'kd',
      label: '击杀/死亡比',
      icon: Crosshair,
      color: '#3EA6FF',
      value: kd,
      decimals: 1,
      note:
        lost && kd < 0.5
          ? '枪口装的是花生米？'
          : `${player.kills} 杀 ${player.deaths} 死`,
    },
    {
      id: 'streak',
      label: '最高连杀',
      icon: Flame,
      color: '#FF8A3D',
      value: player.streakBest,
      decimals: 0,
      note:
        player.streakBest >= 5
          ? '绝世！'
          : player.streakBest >= 3
            ? '手感火热'
            : lost
              ? '子弹都去哪儿了'
              : '下次冲个三连杀',
    },
    {
      id: 'damage',
      label: '总伤害',
      icon: Zap,
      color: '#FF5A5F',
      value: player.damage,
      decimals: 0,
      note: isTopDamage
        ? '输出王'
        : lost && player.damage < maxDamage * 0.4
          ? '重在参与嘛'
          : `距最高还差 ${maxDamage - player.damage}`,
    },
  ];

  return (
    <section aria-label="个人数据" className="mt-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 32, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.1 + i * 0.1, ease: EASE_BOUNCE }}
            >
              <motion.div
                initial="rest"
                whileHover="hover"
                animate="rest"
                variants={{
                  rest: { y: 0 },
                  hover: { y: -6 },
                }}
                transition={{ duration: 0.2 }}
              >
                <ArenaPanel contentClassName="flex flex-col items-center p-6 text-center">
                  <motion.span
                    aria-hidden
                    className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-ink"
                    style={{ backgroundColor: card.color }}
                    variants={{
                      rest: { rotate: 0 },
                      hover: { rotate: [0, -8, 8, -8, 0], transition: { duration: 0.5 } },
                    }}
                  >
                    <Icon size={22} color="#FFFFFF" strokeWidth={2.6} />
                  </motion.span>
                  <CountUp
                    value={card.value}
                    decimals={card.decimals}
                    delay={1.15 + i * 0.1}
                    duration={0.9}
                    className="mt-3 font-num text-[40px] leading-none text-txt"
                  />
                  <span className="mt-2 text-[13px] font-medium tracking-[0.04em] text-txt-mute">
                    {card.label}
                  </span>
                  <span className="mt-1 text-[13px] text-txt-dim">{card.note}</span>
                </ArenaPanel>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
