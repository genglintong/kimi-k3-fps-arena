/**
 * /armory 武器库（armory.md）——4 种武器完整图鉴 + 道具图鉴。
 * 结构：页头 → 武器选择列 + 详情台 → 硬数据对比表 → 战场补给 → CTA。
 * 支持 URL hash 直达（/armory#sniper 或 /armory#items）。
 * 全部数值来自 src/game/constants.ts（经 weaponMetrics 推导），零硬编码。
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { WEAPON_ORDER } from '@/game/constants';
import type { WeaponId } from '@/game/constants';
import { CtaSection, PageHeader, SectionTitle } from '@/components/content/shared';
import WeaponStage from '@/components/content/WeaponStage';
import WeaponTable from '@/components/content/WeaponTable';
import ItemCard from '@/components/content/ItemCards';

const ITEM_TYPES = ['medkit', 'weaponbox', 'shield'] as const;

function weaponFromHash(hash: string): WeaponId | null {
  const id = hash.replace('#', '');
  return (WEAPON_ORDER as readonly string[]).includes(id) ? (id as WeaponId) : null;
}

export default function Armory() {
  const location = useLocation();
  const [selected, setSelected] = useState<WeaponId>(
    () => weaponFromHash(location.hash) ?? 'pistol',
  );

  /** hash 变化时同步选中武器；#items 直达道具段 */
  useEffect(() => {
    const id = weaponFromHash(location.hash);
    if (id) {
      setSelected(id);
    } else if (location.hash === '#items') {
      document.getElementById('items')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const select = (id: WeaponId) => {
    setSelected(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  /** 对比表列头点击：切换详情台并滚回舞台顶部 */
  const selectFromTable = (id: WeaponId) => {
    select(id);
    document.getElementById('weapon-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-12 lg:py-16">
      <PageHeader title="武器库" subtitle="四把玩具枪，四种脾气。数据全公开，童叟无欺。" />

      {/* 武器选择列 + 详情台 */}
      <div id="weapon-stage" className="mt-10 scroll-mt-24 lg:mt-14">
        <WeaponStage selected={selected} onSelect={select} />
      </div>

      {/* 硬数据对比 */}
      <section className="mt-20 lg:mt-24">
        <SectionTitle title="硬数据对比" sub="四个维度一目了然，皇冠标记每行最优" />
        <div className="mt-8">
          <WeaponTable onSelect={selectFromTable} />
        </div>
      </section>

      {/* 战场补给（道具图鉴） */}
      <section id="items" className="mt-20 scroll-mt-24 lg:mt-24">
        <SectionTitle title="战场补给" sub="道具被捡走后按各自的节奏刷新，记住节奏就是记住胜机" />
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {ITEM_TYPES.map((type, i) => (
            <ItemCard key={type} type={type} index={i} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="mt-20 lg:mt-24">
        <CtaSection words={['选好了？', '上场吧！']} size="lg" ghostLabel="返回菜单" />
      </div>
    </div>
  );
}
