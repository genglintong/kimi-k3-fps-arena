/**
 * 进阶技巧手风琴（guide.md §7）：5 条，同时仅展开一条。
 * 展开 height 0→auto（250ms ease-snap），标题前「+」旋转 45° 变「×」。
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import ArenaPanel from '@/components/arena/ArenaPanel';
import { audio } from '@/game/audio';
import { cn } from '@/lib/utils';
import { EASE_SNAP } from './shared';

const TIPS: { title: string; body: string }[] = [
  {
    title: '别站撸，边打边横移',
    body: '横向走位让 80% 的子弹落空，AI 也怕移动靶。站定对枪是最快的回家方式。',
  },
  {
    title: '掩体是你第二个血条',
    body: '石墙挡子弹不挡走位，残血绕柱等绿箱刷新。会借掩体的玩家，等于多一条命。',
  },
  {
    title: '枪要挑场合',
    body: '长廊用步枪/狙击，箱子区端霰弹；别拿烧火棍冲狙击线。看图选枪，胜率减半的反面教材就是一根筋。',
  },
  {
    title: '听声辨位',
    body: '狙击的闷响、霰弹的轰、换弹的咔哒，全是情报（所以别乱按 R）。耳机也是装备。',
  },
  {
    title: '最后 30 秒才是比赛',
    body: '榜首会保守，落后会疯狂。稳住节奏，反杀拿「逆转胜」勋章。别在红字闪烁时缴枪。',
  },
];

export default function TipsAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (i: number) => {
    audio.playUiClick();
    setOpen((prev) => (prev === i ? null : i));
  };

  return (
    <motion.div
      initial={{ y: 32, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, ease: EASE_SNAP }}
      className="mx-auto w-full max-w-[880px]"
    >
      <ArenaPanel contentClassName="divide-y divide-line-soft/40">
        {TIPS.map((tip, i) => {
          const isOpen = open === i;
          return (
            <div key={tip.title}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                className="flex h-16 w-full items-center justify-between gap-4 px-6 text-left transition-colors duration-150 hover:bg-bg-panel-2/50"
              >
                <span className="flex items-center gap-3">
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25, ease: EASE_SNAP }}
                    className={cn('inline-flex', isOpen ? 'text-yel' : 'text-txt-dim')}
                  >
                    <Plus size={20} strokeWidth={3} />
                  </motion.span>
                  <span className={cn('font-head text-xl', isOpen ? 'text-yel' : 'text-txt')}>
                    {tip.title}
                  </span>
                </span>
                <span className="font-num text-[13px] text-txt-dim">0{i + 1}</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE_SNAP }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 pl-[58px] leading-relaxed text-txt-mute">{tip.body}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </ArenaPanel>
    </motion.div>
  );
}
