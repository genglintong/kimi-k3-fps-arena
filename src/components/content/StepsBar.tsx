/**
 * 三步上手条（guide.md §2）：① 跑起来 ② 打准点 ③ 抢装备。
 * 点击卡片滚动定位到对应区块（键位区 / 道具区）。
 */

import { motion } from 'framer-motion';
import ArenaPanel from '@/components/arena/ArenaPanel';
import KeyCap from '@/components/arena/KeyCap';
import { audio } from '@/game/audio';
import { EASE_BOUNCE } from './shared';

interface Step {
  num: string;
  color: string;
  title: string;
  desc: string;
  /** 点击后滚动到的区块 id */
  target: string;
  icon: React.ReactNode;
}

function WasdIcon() {
  return (
    <span className="grid grid-cols-3 gap-1">
      <span />
      <KeyCap label="W" small />
      <span />
      <KeyCap label="A" small />
      <KeyCap label="S" small />
      <KeyCap label="D" small />
    </span>
  );
}

function CrosshairIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
      <circle cx="26" cy="26" r="17" stroke="#3EA6FF" strokeWidth="4" />
      <path d="M26 3v12M26 37v12M3 26h12M37 26h12" stroke="#3EA6FF" strokeWidth="4" strokeLinecap="round" />
      <circle cx="26" cy="26" r="4" fill="#FF5A5F" stroke="#14122E" strokeWidth="2" />
    </svg>
  );
}

function ItemsIcon() {
  return (
    <span className="flex items-end gap-1">
      <img src="/item-weaponbox.svg" alt="" className="h-10 w-10" draggable={false} />
      <img src="/item-medkit.svg" alt="" className="h-11 w-11" draggable={false} />
      <img src="/item-shield.svg" alt="" className="h-10 w-10" draggable={false} />
    </span>
  );
}

const STEPS: Step[] = [
  {
    num: '1',
    color: '#FFC831',
    title: '跑起来',
    desc: 'WASD 移动，躲开子弹',
    target: 'keys',
    icon: <WasdIcon />,
  },
  {
    num: '2',
    color: '#3EA6FF',
    title: '打准点',
    desc: '鼠标瞄准，左键开火',
    target: 'keys',
    icon: <CrosshairIcon />,
  },
  {
    num: '3',
    color: '#3ED97E',
    title: '抢装备',
    desc: '武器箱出好枪，绿箱回血，蓝盾加防',
    target: 'items',
    icon: <ItemsIcon />,
  },
];

export default function StepsBar() {
  const jump = (target: string) => {
    audio.playUiClick();
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {STEPS.map((step, i) => (
        <motion.div
          key={step.num}
          initial={{ y: 48, scale: 0.9, opacity: 0 }}
          whileInView={{ y: 0, scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: i * 0.12, ease: EASE_BOUNCE }}
        >
          <ArenaPanel
            onClick={() => jump(step.target)}
            contentClassName="flex h-full items-center gap-5 p-6"
            className="group h-full transition-shadow duration-200 hover:shadow-[0_20px_44px_rgba(8,6,40,0.6)]"
          >
            <motion.span
              aria-hidden
              initial={{ rotate: -10, opacity: 0 }}
              whileInView={{ rotate: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 + 0.15, ease: EASE_BOUNCE }}
              className="font-num text-[64px] leading-none"
              style={{ color: step.color, textShadow: '0 4px 0 #14122E' }}
            >
              {step.num}
            </motion.span>
            <span className="flex-1">
              <span className="flex items-center gap-3">
                <span className="font-head text-[26px] text-txt">{step.title}</span>
                <span aria-hidden className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                  {step.icon}
                </span>
              </span>
              <span className="mt-1 block text-[13px] font-medium tracking-[0.04em] text-txt-mute">
                {step.desc}
              </span>
            </span>
          </ArenaPanel>
        </motion.div>
      ))}
    </div>
  );
}
