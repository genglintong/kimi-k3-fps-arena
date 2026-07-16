/**
 * 武器对比表（armory.md §4）：5 行数值 × 4 武器列，数据全部由 weaponMetrics 推导。
 * 每行最优值 yel 加粗 + 皇冠；hover 列头整列高亮；点击列头切换详情台。
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import ArenaPanel from '@/components/arena/ArenaPanel';
import { WEAPONS, WEAPON_ORDER } from '@/game/constants';
import type { WeaponId } from '@/game/constants';
import { audio } from '@/game/audio';
import { cn } from '@/lib/utils';
import { EASE_SNAP } from './shared';
import { COMPARE_ROWS, bestWeaponFor } from './weaponMetrics';

export default function WeaponTable({ onSelect }: { onSelect: (id: WeaponId) => void }) {
  const [hoverCol, setHoverCol] = useState<WeaponId | null>(null);

  return (
    <ArenaPanel contentClassName="p-5 sm:p-8">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-32 p-2 text-left text-[13px] font-medium text-txt-dim">项目</th>
              {WEAPON_ORDER.map((id) => {
                const w = WEAPONS[id];
                return (
                  <th key={id} className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        audio.playUiClick();
                        onSelect(id);
                      }}
                      onMouseEnter={() => setHoverCol(id)}
                      onMouseLeave={() => setHoverCol(null)}
                      className={cn(
                        'flex w-full flex-col items-center gap-1 rounded-xl px-2 py-3 transition-colors duration-150',
                        hoverCol === id ? 'bg-bg-panel-2' : undefined,
                      )}
                      style={hoverCol === id ? undefined : { backgroundColor: `${w.color}26` }}
                      title={`查看${w.name}详情`}
                    >
                      <img src={w.image} alt="" draggable={false} className="h-9 w-auto" />
                      <span className="font-head text-lg leading-tight text-txt">{w.name}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row, rowIdx) => {
              const best = bestWeaponFor(row);
              return (
                <motion.tr
                  key={row.label}
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.35, delay: rowIdx * 0.07, ease: EASE_SNAP }}
                >
                  <td className="border-t border-line-soft/40 p-3 text-[13px] font-medium text-txt-mute">
                    {row.label}
                  </td>
                  {WEAPON_ORDER.map((id) => {
                    const w = WEAPONS[id];
                    const isBest = id === best;
                    return (
                      <td
                        key={id}
                        onMouseEnter={() => setHoverCol(id)}
                        onMouseLeave={() => setHoverCol(null)}
                        className={cn(
                          'border-t border-line-soft/40 p-3 text-center transition-colors duration-150',
                          hoverCol === id && 'bg-bg-panel-2/70',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex items-center justify-center gap-1 font-num text-base',
                            isBest ? 'font-bold text-yel' : 'text-txt-mute',
                          )}
                        >
                          {isBest ? (
                            <motion.span
                              initial={{ scale: 0 }}
                              whileInView={{ scale: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.3, delay: rowIdx * 0.07 + 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                              className="inline-flex"
                            >
                              <Crown size={14} className="fill-yel text-yel-dark" aria-label="本行最优" />
                            </motion.span>
                          ) : null}
                          {row.text(w)}
                        </span>
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-[13px] text-txt-dim">
        点击列头可切换上方详情台 · 数值与游戏内完全一致，童叟无欺
      </p>
    </ArenaPanel>
  );
}
