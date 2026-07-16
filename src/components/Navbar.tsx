/**
 * Navbar —— 吸顶迷你导航条（home.md §2）
 * sticky top-0 z-50，h-16；rgba(21,23,61,0.7) + backdrop-blur + 底部 1px line-soft。
 * 左：mini Logo + v1.0 芯片；右：武器库 / 玩法指南链接 + 音效开关 + 开始对战 CTA。
 */

import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import ArenaButton from '@/components/arena/ArenaButton';
import Chip from '@/components/arena/Chip';
import { audio } from '@/game/audio';
import { loadSettings, updateSettings, SETTINGS_EVENT } from '@/game/settings';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/armory', label: '武器库' },
  { to: '/guide', label: '玩法指南' },
];

export default function Navbar() {
  const [soundOn, setSoundOn] = useState(() => loadSettings().sound);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ sound: boolean }>).detail;
      if (detail) setSoundOn(detail.sound);
      else setSoundOn(loadSettings().sound);
    };
    window.addEventListener(SETTINGS_EVENT, onChanged);
    return () => window.removeEventListener(SETTINGS_EVENT, onChanged);
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    const settings = { ...loadSettings(), sound: next };
    audio.setEnabled(next);
    if (next) audio.playUiClick();
    updateSettings(settings);
  };

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50 border-b border-line-soft bg-[rgba(21,23,61,0.7)] backdrop-blur-[12px]"
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6">
        {/* 左：mini Logo + 版本芯片 */}
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="回到首页" className="flex items-center">
            <img src="/logo.svg" alt="枪火竞技场 GUN ARENA" className="h-10 w-auto" draggable={false} />
          </Link>
          <Chip color="#FFC831" className="hidden sm:inline-flex">
            v1.0
          </Chip>
        </div>

        {/* 右：导航 + 音效 + CTA */}
        <nav className="flex items-center gap-2 sm:gap-4">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'group relative hidden px-1 py-2 text-base font-medium transition-colors duration-150 md:inline-block',
                  isActive ? 'text-txt' : 'text-txt-mute hover:text-txt',
                )
              }
            >
              {link.label}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 rounded-full bg-yel transition-transform duration-150 group-hover:scale-x-100"
              />
            </NavLink>
          ))}

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? '关闭音效' : '开启音效'}
            className="grid h-10 w-10 place-items-center rounded-full border border-line-soft bg-bg-panel-2 text-txt-mute transition-all duration-150 hover:scale-105 hover:text-txt active:scale-95"
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          <ArenaButton to="/play" size="sm" className="hidden sm:inline-flex">
            开始对战
          </ArenaButton>
        </nav>
      </div>
    </motion.header>
  );
}
