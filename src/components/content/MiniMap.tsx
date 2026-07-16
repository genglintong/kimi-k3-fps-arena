/**
 * 地图与道具（guide.md §5）：
 * 左「竞技场一览」SVG 迷你地图（240×160 = 世界 2400×1600 的 10:1 微缩，
 * 尺寸取自 WORLD_WIDTH/HEIGHT）+ 右「道具速查」紧凑卡。
 * hover 地图斑点 ↔ 道具卡 双向高亮；点击道具卡跳 /armory#items。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import ArenaPanel from '@/components/arena/ArenaPanel';
import Chip from '@/components/arena/Chip';
import ItemCard from '@/components/content/ItemCards';
import { ITEMS, WORLD_HEIGHT, WORLD_WIDTH } from '@/game/constants';
import type { ItemType } from '@/game/constants';
import { audio } from '@/game/audio';
import { EASE_BOUNCE, EASE_SNAP } from './shared';

/* ------------------------------------------------------------------ */
/* 迷你地图布局（示意位置，等比 10:1 微缩；道具数据来自 ITEMS）              */
/* ------------------------------------------------------------------ */

/** 掩体块（灰蓝，x/y/w/h 单位 = 地图像素） */
const COVERS: { x: number; y: number; w: number; h: number }[] = [
  { x: 44, y: 34, w: 26, h: 16 },
  { x: 170, y: 34, w: 26, h: 16 },
  { x: 44, y: 110, w: 26, h: 16 },
  { x: 170, y: 110, w: 26, h: 16 },
  { x: 106, y: 70, w: 28, h: 18 },
  { x: 64, y: 70, w: 18, h: 12 },
  { x: 158, y: 70, w: 18, h: 12 },
];

/** 道具点：回血 ×3 / 武器箱 ×3 / 护盾 ×2（guide.md §5） */
const ITEM_PADS: { type: ItemType; x: number; y: number }[] = [
  { type: 'medkit', x: 30, y: 78 },
  { type: 'medkit', x: 120, y: 132 },
  { type: 'medkit', x: 210, y: 78 },
  { type: 'weaponbox', x: 62, y: 24 },
  { type: 'weaponbox', x: 120, y: 52 },
  { type: 'weaponbox', x: 178, y: 136 },
  { type: 'shield', x: 62, y: 136 },
  { type: 'shield', x: 178, y: 24 },
];

/** 出生点 ×8 */
const SPAWNS: { x: number; y: number }[] = [
  { x: 10, y: 10 },
  { x: 230, y: 10 },
  { x: 10, y: 150 },
  { x: 230, y: 150 },
  { x: 120, y: 8 },
  { x: 120, y: 152 },
  { x: 8, y: 80 },
  { x: 232, y: 80 },
];

const ITEM_ORDER: ItemType[] = ['medkit', 'weaponbox', 'shield'];

const padCount = (type: ItemType) => ITEM_PADS.filter((p) => p.type === type).length;

/* ------------------------------------------------------------------ */
/* MiniMap                                                               */
/* ------------------------------------------------------------------ */

export default function MiniMap() {
  const navigate = useNavigate();
  const [hoverItem, setHoverItem] = useState<ItemType | null>(null);

  const goArmoryItems = () => {
    audio.playUiClick();
    navigate('/armory#items');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[7fr_5fr]">
      {/* 左：竞技场一览 */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: EASE_SNAP }}
      >
        <ArenaPanel contentClassName="p-5 sm:p-6">
          <p className="mb-4 text-[13px] font-medium tracking-[0.04em] text-txt-dim">
            竞技场一览（{WORLD_WIDTH} × {WORLD_HEIGHT} 微缩图）
          </p>
          <svg
            viewBox={`0 0 ${WORLD_WIDTH / 10} ${WORLD_HEIGHT / 10}`}
            className="h-auto w-full rounded-xl"
            role="img"
            aria-label="竞技场迷你地图：掩体、道具点与出生点分布"
          >
            {/* 地板 */}
            <rect x="2" y="2" width="236" height="156" rx="8" fill="#7FD1A8" stroke="#14122E" strokeWidth="3" />
            <rect x="0" y="76" width="240" height="8" fill="#8CDAB2" opacity="0.7" />
            <rect x="116" y="0" width="8" height="160" fill="#8CDAB2" opacity="0.7" />
            <circle cx="120" cy="80" r="26" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.45" />

            {/* 掩体 */}
            {COVERS.map((c, i) => (
              <rect
                key={i}
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx="3"
                fill="#8A90C8"
                stroke="#14122E"
                strokeWidth="2"
              />
            ))}

            {/* 出生点 */}
            {SPAWNS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r="3" fill="#FFFFFF" opacity="0.85" stroke="#14122E" strokeWidth="1" />
            ))}

            {/* 道具点（弹跳入场 + 呼吸光 + hover 联动） */}
            {ITEM_PADS.map((p, i) => {
              const active = hoverItem === p.type;
              return (
                <g
                  key={i}
                  transform={`translate(${p.x}, ${p.y})`}
                  onMouseEnter={() => setHoverItem(p.type)}
                  onMouseLeave={() => setHoverItem(null)}
                  className="cursor-pointer"
                >
                  <motion.circle
                    r={active ? 6.5 : 5}
                    fill={ITEMS[p.type].color}
                    stroke="#14122E"
                    strokeWidth="1.6"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.09, ease: EASE_BOUNCE }}
                    style={{
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                      filter: active ? `drop-shadow(0 0 4px ${ITEMS[p.type].color})` : undefined,
                    }}
                  />
                  <motion.circle
                    r="7.5"
                    fill="none"
                    stroke={ITEMS[p.type].color}
                    strokeWidth="1"
                    animate={{ opacity: [0.15, 0.7, 0.15] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.35, ease: 'easeInOut' }}
                  />
                </g>
              );
            })}
          </svg>

          {/* 图例 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {ITEM_ORDER.map((type) => (
              <Chip key={type} color={ITEMS[type].color}>
                {ITEMS[type].name} ×{padCount(type)}
              </Chip>
            ))}
            <Chip color="#FFFFFF">出生点 ×{SPAWNS.length}</Chip>
            <Chip color="#8A90C8">掩体</Chip>
          </div>
        </ArenaPanel>
      </motion.div>

      {/* 右：道具速查 */}
      <div className="flex flex-col gap-4">
        {ITEM_ORDER.map((type, i) => (
          <ItemCard
            key={type}
            type={type}
            index={i}
            compact
            active={hoverItem === type}
            onMouseEnter={() => setHoverItem(type)}
            onMouseLeave={() => setHoverItem(null)}
            onClick={goArmoryItems}
          />
        ))}
        <p className="text-center text-[13px] text-txt-dim">hover 地图斑点可联动高亮 · 点击卡片看完整图鉴</p>
      </div>
    </div>
  );
}
