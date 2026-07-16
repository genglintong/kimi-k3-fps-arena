/**
 * KillFeedItem —— 击杀播报条（design.md §10.7）
 * [击杀者徽章+名字] [武器小图标] [被击杀者徽章+名字]
 * 深底 70% 透明 + 左 3px 语义色条；入场 x +24→0, opacity 0→1（200ms）。
 * 驻留 4s 后的淡出由父级用 AnimatePresence 控制（exit 已内置）。
 */

import { motion } from 'framer-motion';
import { WEAPONS } from '@/game/constants';
import type { WeaponId } from '@/game/constants';
import { cn } from '@/lib/utils';

export interface KillFeedItemProps {
  killerName: string;
  killerColor: string;
  victimName: string;
  victimColor: string;
  weapon?: WeaponId;
  /** 玩家参与的条目加粗 + 两侧留白增大 */
  highlight?: boolean;
}

function MiniDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-ink"
      style={{ backgroundColor: color }}
    />
  );
}

export default function KillFeedItem({
  killerName,
  killerColor,
  victimName,
  victimColor,
  weapon,
  highlight,
}: KillFeedItemProps) {
  return (
    <motion.div
      layout="position"
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex items-center gap-2 rounded-lg bg-void/70 py-1.5 pl-2.5 pr-3 text-[13px] text-txt backdrop-blur-sm',
        highlight && 'gap-3 px-4 font-bold',
      )}
      style={{ borderLeft: `3px solid ${killerColor}` }}
    >
      <MiniDot color={killerColor} />
      <span className="max-w-24 truncate">{killerName}</span>
      {weapon ? (
        <img
          src={WEAPONS[weapon].image}
          alt={WEAPONS[weapon].name}
          className="h-5 w-auto shrink-0"
          draggable={false}
        />
      ) : (
        <span aria-hidden className="text-txt-dim">
          ▸
        </span>
      )}
      <MiniDot color={victimColor} />
      <span className="max-w-24 truncate text-txt-mute">{victimName}</span>
    </motion.div>
  );
}
