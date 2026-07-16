/**
 * AI 对手档案（guide.md §6）：BOT_ROSTER 五张性格卡。
 * 卡面：64px 表情头像（按 personality 绘制微表情）+ 名字 + 性格 Chip + bio；
 * hover 揭示「弱点」一行；底部附 7 机器人模式说明（BOT_EXTRA_POOL）。
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import ArenaPanel from '@/components/arena/ArenaPanel';
import Chip from '@/components/arena/Chip';
import { BOT_COUNT_OPTIONS, BOT_EXTRA_POOL, BOT_ROSTER, DEFAULT_BOT_COUNT } from '@/game/constants';
import type { BotPersonality } from '@/game/constants';
import { cn } from '@/lib/utils';
import { EASE_BOUNCE } from './shared';

/* ------------------------------------------------------------------ */
/* 弱点揭示（guide.md §6，按性格给出对策一行）                              */
/* ------------------------------------------------------------------ */

const BOT_WEAKNESS: Record<BotPersonality, string> = {
  berserker: '弱点：射程——拉开距离放风筝',
  gunner: '弱点：换弹间隙——趁它换弹送它回家',
  roamer: '弱点：补给点——守住道具等它上门',
  sniper: '弱点：近身——贴脸强吃它',
  camper: '弱点：预瞄——转角先开枪探路',
};

/* ------------------------------------------------------------------ */
/* Q 版微表情（48 viewBox，莽夫怒眉 / 火力狂咬牙 / 游击手坏笑 / 老六眯眼 / 伏地魔装乖） */
/* ------------------------------------------------------------------ */

function BotFace({ personality }: { personality: BotPersonality }) {
  const ink = '#14122E';
  switch (personality) {
    case 'berserker': {
      /* 怒眉 + 龇牙冲劲 */
      return (
        <g stroke={ink} strokeLinecap="round">
          <path d="M10 12 l10 4" strokeWidth="2.8" />
          <path d="M38 12 l-10 4" strokeWidth="2.8" />
          <circle cx="16" cy="21" r="3" fill={ink} stroke="none" />
          <circle cx="32" cy="21" r="3" fill={ink} stroke="none" />
          <path d="M16 32 q8 8 16 0" strokeWidth="2.6" fill="none" />
        </g>
      );
    }
    case 'gunner': {
      /* 咬牙 */
      return (
        <g stroke={ink} strokeLinecap="round">
          <circle cx="16" cy="19" r="3.2" fill={ink} stroke="none" />
          <circle cx="32" cy="19" r="3.2" fill={ink} stroke="none" />
          <rect x="14" y="29" width="20" height="7" rx="3.5" fill="#fff" strokeWidth="2.4" />
          <path d="M20.5 29.5v6M27.5 29.5v6" strokeWidth="1.8" />
        </g>
      );
    }
    case 'roamer': {
      /* 坏笑（歪嘴 + 挑眉） */
      return (
        <g stroke={ink} strokeLinecap="round">
          <path d="M11 13 q5 -3 9 0" strokeWidth="2.4" fill="none" />
          <circle cx="16" cy="20" r="3" fill={ink} stroke="none" />
          <circle cx="32" cy="20" r="3" fill={ink} stroke="none" />
          <path d="M16 31 q9 7 17 -2" strokeWidth="2.6" fill="none" />
        </g>
      );
    }
    case 'sniper': {
      /* 眯眼冷静 */
      return (
        <g stroke={ink} strokeLinecap="round">
          <path d="M11 20 h10" strokeWidth="2.8" />
          <path d="M27 20 h10" strokeWidth="2.8" />
          <path d="M17 32 h14" strokeWidth="2.6" />
        </g>
      );
    }
    case 'camper': {
      /* 装乖（大眼睛 + 害羞抿嘴 + 脸红） */
      return (
        <g stroke={ink} strokeLinecap="round">
          <circle cx="16" cy="19" r="4.6" fill="#fff" strokeWidth="2" />
          <circle cx="32" cy="19" r="4.6" fill="#fff" strokeWidth="2" />
          <circle cx="17" cy="20" r="2.2" fill={ink} stroke="none" />
          <circle cx="33" cy="20" r="2.2" fill={ink} stroke="none" />
          <path d="M20 32 q4 4 8 0" strokeWidth="2.4" fill="none" />
          <circle cx="9" cy="27" r="2.4" fill="rgba(20,18,46,0.25)" stroke="none" />
          <circle cx="39" cy="27" r="2.4" fill="rgba(20,18,46,0.25)" stroke="none" />
        </g>
      );
    }
  }
}

/** 头像悬浮微组件（3s 错相浮动，memo 隔离） */
const FloatingAvatar = memo(function FloatingAvatar({
  color,
  personality,
  name,
  delay,
}: {
  color: string;
  personality: BotPersonality;
  name: string;
  delay: number;
}) {
  return (
    <motion.span
      aria-hidden
      className="inline-grid h-16 w-16 shrink-0 place-items-center rounded-full border-[3px] border-ink transition-transform duration-200 group-hover:scale-[1.15]"
      style={{ backgroundColor: color }}
      animate={{ y: [-5, 5, -5] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <svg viewBox="0 0 48 48" width="54" height="54" role="img" aria-label={`${name}的表情`}>
        <BotFace personality={personality} />
      </svg>
    </motion.span>
  );
});

/* ------------------------------------------------------------------ */
/* BotCards                                                              */
/* ------------------------------------------------------------------ */

export default function BotCards() {
  return (
    <>
      <div className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {BOT_ROSTER.map((bot, i) => (
          <motion.div
            key={bot.id}
            initial={{ y: 40, rotate: i % 2 === 0 ? -2 : 2, opacity: 0 }}
            whileInView={{ y: 0, rotate: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.09, ease: EASE_BOUNCE }}
            whileHover={{ y: -8, scale: 1.03 }}
            className="group w-[72vw] shrink-0 snap-center sm:w-[46vw] lg:w-auto"
          >
            <ArenaPanel colorBar={bot.color} contentClassName="flex h-full flex-col p-5" className="h-full">
              <FloatingAvatar color={bot.color} personality={bot.personality} name={bot.name} delay={i * 0.35} />
              <div className="mt-4 flex items-center gap-2">
                <h3 className="font-head text-[22px] leading-tight text-txt">{bot.name}</h3>
              </div>
              <div className="mt-2">
                <Chip color={bot.color}>{bot.trait}</Chip>
              </div>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-txt-mute">{bot.bio}</p>
              {/* hover 揭示：弱点 */}
              <div
                className={cn(
                  'grid transition-all duration-250',
                  'grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100',
                )}
              >
                <div className="overflow-hidden">
                  <p
                    className="mt-3 rounded-lg px-3 py-2 text-[13px] font-medium"
                    style={{ backgroundColor: `${bot.color}1f`, color: bot.color }}
                  >
                    {BOT_WEAKNESS[bot.personality]}
                  </p>
                </div>
              </div>
            </ArenaPanel>
          </motion.div>
        ))}
      </div>
      <p className="mt-5 text-center text-[13px] leading-relaxed text-txt-dim">
        开局可选 {BOT_COUNT_OPTIONS.join(' / ')} 名机器人（默认 {DEFAULT_BOT_COUNT} 名）；7
        名模式还会乱入两位隐藏角色：
        {BOT_EXTRA_POOL.map((b) => `${b.name}（${b.trait}）`).join('、')}！
      </p>
    </>
  );
}
