/**
 * /guide 玩法指南（guide.md）——新玩家 60 秒上手 + 老玩家进阶。
 * 结构：页头 → 三步上手 → 键位特训（交互式）→ 比赛规则 → 地图与道具
 *       → AI 对手档案 → 进阶技巧 → CTA。
 * 机器人 / 道具 / 赛制数值全部来自 src/game/constants.ts。
 */

import { CtaSection, PageHeader, SectionTitle } from '@/components/content/shared';
import StepsBar from '@/components/content/StepsBar';
import KeyboardTrainer from '@/components/content/KeyboardTrainer';
import MatchTimeline from '@/components/content/MatchTimeline';
import MiniMap from '@/components/content/MiniMap';
import BotCards from '@/components/content/BotCards';
import TipsAccordion from '@/components/content/TipsAccordion';

export default function Guide() {
  return (
    <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-12 lg:py-16">
      <PageHeader title="怎么玩" subtitle="60 秒速成，剩下的交给手感。" />

      {/* 三步上手 */}
      <section className="mt-10 lg:mt-14">
        <StepsBar />
      </section>

      {/* 键位教学 */}
      <section id="keys" className="mt-20 scroll-mt-24 lg:mt-24">
        <SectionTitle title="键位教学" sub="这不是一张图——是真的可以按的键盘" />
        <div className="mt-8">
          <KeyboardTrainer />
        </div>
      </section>

      {/* 比赛规则 */}
      <section className="mt-20 lg:mt-24">
        <SectionTitle title="比赛规则" sub="三分钟一场，从倒计时到结算的全流程" />
        <div className="mt-8">
          <MatchTimeline />
        </div>
      </section>

      {/* 地图与道具 */}
      <section id="items" className="mt-20 scroll-mt-24 lg:mt-24">
        <SectionTitle title="地图与道具" sub="背下补给点，就是背下半个胜利" />
        <div className="mt-8">
          <MiniMap />
        </div>
      </section>

      {/* AI 对手档案 */}
      <section className="mt-20 lg:mt-24">
        <SectionTitle title="认识你的对手" sub="5 个机器人，5 种臭脾气。摸清它们，胜率翻倍。" />
        <BotCards />
      </section>

      {/* 进阶技巧 */}
      <section className="mt-20 lg:mt-24">
        <SectionTitle title="进阶技巧" sub="新手看键位，高手看这里" />
        <div className="mt-8">
          <TipsAccordion />
        </div>
      </section>

      {/* CTA */}
      <div className="mt-20 lg:mt-24">
        <CtaSection words={['学会了？', '来一局！']} size="xl" ghostLabel="回主菜单" />
      </div>
    </div>
  );
}
