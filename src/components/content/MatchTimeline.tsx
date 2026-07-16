/**
 * 比赛规则（guide.md §4）：赛制时间轴（倒计时 → 激战 → 最后警报 → 加时 → 结算）
 * + 计分 / 重生 / 胜负 三列规则卡。所有时长数值来自 constants。
 */

import { motion } from 'framer-motion';
import { Crown, Hourglass, RotateCcw, Siren, Timer, Trophy, Zap } from 'lucide-react';
import ArenaPanel from '@/components/arena/ArenaPanel';
import {
  COUNTDOWN_S,
  LOW_TIME_WARNING_S,
  MATCH_DURATION_S,
  OVERTIME_S,
  RESPAWN_DELAY_S,
  RESPAWN_INVINCIBLE_S,
  SCORE_PER_KILL,
} from '@/game/constants';
import { cn } from '@/lib/utils';
import { EASE_SNAP } from './shared';

/* ------------------------------------------------------------------ */
/* 赛制时间轴（段长为设计压缩比，非真实时长比；标签数值来自 constants）      */
/* ------------------------------------------------------------------ */

interface Segment {
  key: string;
  label: string;
  seconds: string;
  icon: React.ReactNode;
  /** 设计压缩后的宽度比（guide.md §4：8:76:10:6 基础上加入加时段） */
  flex: number;
  color: string;
  textDark: boolean;
  pulse?: boolean;
  tip: string;
  /** 边缘段的 tooltip 对齐（防止溢出面板） */
  tipAlign?: 'left' | 'right';
}

const SEGMENTS: Segment[] = [
  {
    key: 'countdown',
    label: '倒计时',
    seconds: `${Math.round(COUNTDOWN_S)}s`,
    icon: <Timer size={18} />,
    flex: 7,
    color: '#6E74B8',
    textDark: false,
    tip: '3-2-1-GO！摆好姿势，开场直奔最近的武器箱。',
    tipAlign: 'left',
  },
  {
    key: 'battle',
    label: '激战',
    seconds: `${MATCH_DURATION_S - LOW_TIME_WARNING_S}s`,
    icon: <Zap size={18} />,
    flex: 63,
    color: '#FFC831',
    textDark: true,
    tip: `击杀 +${SCORE_PER_KILL} · 道具持续刷新。分数拉开的关键期。`,
  },
  {
    key: 'warning',
    label: '警报',
    seconds: `${LOW_TIME_WARNING_S}s`,
    icon: <Siren size={18} />,
    flex: 10,
    color: '#FF5A5F',
    textDark: false,
    pulse: true,
    tip: '计时变红 + 心跳音效：榜首想苟住，落后想拼命。',
  },
  {
    key: 'overtime',
    label: '加时',
    seconds: `${OVERTIME_S}s`,
    icon: <Hourglass size={18} />,
    flex: 9,
    color: '#9B5CFF',
    textDark: false,
    tip: '仅榜首平杀时触发：突然死亡，先拿击杀者直接夺冠！',
  },
  {
    key: 'results',
    label: '结算',
    seconds: '',
    icon: <Trophy size={18} />,
    flex: 11,
    color: '#3ED97E',
    textDark: true,
    tip: '积分榜结算 + 勋章颁发，然后——再来一局！',
    tipAlign: 'right',
  },
];

function Timeline() {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE_SNAP }}
      className="flex h-28 origin-left overflow-hidden rounded-2xl border-2 border-line-soft"
    >
      {SEGMENTS.map((seg) => (
        <div
          key={seg.key}
          className="group relative flex flex-col items-center justify-center gap-0.5 border-r border-ink/20 px-1 last:border-r-0"
          style={{ flexGrow: seg.flex, flexBasis: 0, backgroundColor: seg.color }}
        >
          {seg.pulse ? (
            <motion.span
              aria-hidden
              className="absolute inset-0"
              style={{ backgroundColor: seg.color }}
              animate={{ opacity: [0, 0.45, 0] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          <span
            aria-hidden
            className="relative hidden sm:block"
            style={{ color: seg.textDark ? '#14122E' : '#FFFFFF' }}
          >
            {seg.icon}
          </span>
          <span
            className="relative font-head text-base leading-tight sm:text-lg"
            style={{ color: seg.textDark ? '#14122E' : '#FFFFFF' }}
          >
            {seg.label}
          </span>
          {seg.seconds ? (
            <span
              className="relative font-num text-[13px] leading-tight"
              style={{ color: seg.textDark ? '#14122E' : 'rgba(255,255,255,0.85)' }}
            >
              {seg.seconds}
            </span>
          ) : null}
          {/* hover tooltip（置于条下方并对齐边缘段，避免被面板 overflow 裁切） */}
          <span
            className={cn(
              'pointer-events-none absolute top-full z-20 mt-2 w-44 whitespace-normal rounded-lg border border-line-soft bg-bg-deep px-2.5 py-1.5 text-center text-[13px] leading-snug text-txt opacity-0 shadow-panel transition-opacity duration-150 group-hover:opacity-100',
              seg.tipAlign === 'left' && 'left-0',
              seg.tipAlign === 'right' && 'right-0',
              !seg.tipAlign && 'left-1/2 -translate-x-1/2',
            )}
          >
            {seg.tip}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 规则卡                                                                */
/* ------------------------------------------------------------------ */

const RULES: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Trophy size={20} className="text-yel" />,
    title: '计分',
    body: `击杀 +${SCORE_PER_KILL}，按击杀数排名；并列先比死亡少，再比总伤害高。`,
  },
  {
    icon: <RotateCcw size={20} className="text-blu" />,
    title: '重生',
    body: `阵亡 ${RESPAWN_DELAY_S} 秒后满血重返战场（随机安全出生点 + ${RESPAWN_INVINCIBLE_S} 秒无敌泡泡）。倒地不掉枪——但你攒的弹药不等人。`,
  },
  {
    icon: <Crown size={20} className="text-pur" />,
    title: '胜负',
    body: `${MATCH_DURATION_S / 60} 分钟时间到，击杀王获胜；若榜首平杀进入 ${OVERTIME_S} 秒加时——先拿击杀者直接夺冠。`,
  },
];

export default function MatchTimeline() {
  return (
    <ArenaPanel contentClassName="p-6 lg:p-10">
      <Timeline />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {RULES.map((rule, i) => (
          <motion.div
            key={rule.title}
            initial={{ y: 32, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: EASE_SNAP }}
            className="rounded-2xl border border-line-soft/50 bg-bg-panel-2/60 p-5"
          >
            <div className="flex items-center gap-2">
              {rule.icon}
              <span className="text-[13px] font-medium tracking-[0.04em] text-txt-mute">{rule.title}</span>
            </div>
            <p className="mt-2 leading-relaxed text-txt">{rule.body}</p>
          </motion.div>
        ))}
      </div>
    </ArenaPanel>
  );
}
