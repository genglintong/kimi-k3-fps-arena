/**
 * 道具图鉴卡（armory.md §5 / guide.md §5）——数据全部来自 ITEMS。
 * 满版（武器库）与紧凑版（指南页速查）两种形态，支持跨卡高亮联动。
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import ArenaPanel from '@/components/arena/ArenaPanel';
import { ITEMS } from '@/game/constants';
import type { ItemDef, ItemType } from '@/game/constants';
import { cn } from '@/lib/utils';
import { EASE_BOUNCE } from './shared';

/** 一句话战术（armory.md §5 文案） */
export const ITEM_TACTICS: Record<ItemType, string> = {
  medkit: '残血别硬刚，绿箱在召唤。',
  weaponbox: '好枪先到先得，手慢无。',
  shield: '蓝盾在身，敢打敢拼。',
};

/** 效果行文案（数值来自 ITEMS） */
function effectText(item: ItemDef): string {
  if (item.type === 'medkit') return `+${item.value} HP`;
  if (item.type === 'shield') return `+${item.value} 护盾`;
  return '随机武器';
}

/** 插画悬浮微组件（独立永恒动画，memo 隔离重渲染） */
const FloatingItemImg = memo(function FloatingItemImg({
  src,
  alt,
  className,
  delay,
}: {
  src: string;
  alt: string;
  className?: string;
  delay: number;
}) {
  return (
    <motion.img
      src={src}
      alt={alt}
      draggable={false}
      className={className}
      animate={{ y: [-6, 6, -6] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
});

export interface ItemCardProps {
  type: ItemType;
  index?: number;
  /** 紧凑版（guide 道具速查：横排小卡） */
  compact?: boolean;
  /** 外部联动高亮（迷你地图 hover） */
  active?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

export default function ItemCard({
  type,
  index = 0,
  compact,
  active,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: ItemCardProps) {
  const item = ITEMS[type];

  return (
    <motion.div
      initial={{ y: 40, scale: 0.92, opacity: 0 }}
      whileInView={{ y: 0, scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: EASE_BOUNCE }}
      whileHover={{ y: -8 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="h-full rounded-[20px] transition-shadow duration-200"
      style={active ? { boxShadow: `0 0 0 2px ${item.color}, 0 0 24px ${item.color}80` } : undefined}
    >
      <ArenaPanel
        colorBar={item.color}
        onClick={onClick}
        className="group h-full"
        contentClassName={cn(
          compact ? 'flex items-center gap-4 p-4' : 'flex h-full flex-col items-center p-6 text-center',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'shrink-0 transition-transform duration-200',
            compact
              ? 'group-hover:scale-110'
              : 'group-hover:rotate-3 group-hover:scale-[1.12]',
          )}
        >
          <FloatingItemImg
            src={item.image}
            alt={item.name}
            delay={index * 0.4}
            className={cn('w-auto', compact ? 'h-16' : 'h-24')}
          />
        </span>

        <div className={cn(!compact && 'mt-4 flex flex-1 flex-col items-center')}>
          <div className={cn(compact && 'flex items-baseline gap-2')}>
            <h3 className="font-head text-[26px] leading-tight text-txt">{item.name}</h3>
            <span
              className={cn('font-num text-base', compact && 'text-[14px]')}
              style={{ color: item.color }}
            >
              {effectText(item)}
            </span>
          </div>
          <p className="mt-1 text-[13px] font-medium tracking-[0.04em] text-txt-dim">
            被拾取后 {item.respawnS}s 刷新
          </p>
          <p className={cn('text-[13px] leading-relaxed text-txt-mute', compact ? 'mt-1' : 'mt-2')}>
            {ITEM_TACTICS[type]}
          </p>
        </div>
      </ArenaPanel>
    </motion.div>
  );
}
