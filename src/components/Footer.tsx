/**
 * Footer —— 页脚条（home.md §7）
 * h-20，flex 两端，顶部 1px line-soft。
 * 左：技术声明；右：⚙ 设置（打开设置抽屉）· ♥ 关于（toast）。
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Settings } from 'lucide-react';
import { audio } from '@/game/audio';

export interface FooterProps {
  onOpenSettings?: () => void;
}

export default function Footer({ onOpenSettings }: FooterProps) {
  const [toast, setToast] = useState(false);

  const showAbout = () => {
    audio.playUiClick();
    setToast(true);
    window.setTimeout(() => setToast(false), 2200);
  };

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="relative border-t border-line-soft"
    >
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-8">
        <p className="text-[13px] text-txt-dim">
          枪火竞技场 · 纯前端打造 · React + Canvas + WebAudio
        </p>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              audio.playUiClick();
              onOpenSettings?.();
            }}
            className="flex items-center gap-1.5 text-[13px] text-txt-mute transition-colors hover:text-txt"
          >
            <Settings size={14} />
            设置
          </button>
          <button
            type="button"
            onClick={showAbout}
            className="flex items-center gap-1.5 text-[13px] text-txt-mute transition-colors hover:text-txt"
          >
            <Heart size={14} className="text-red" />
            关于
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            className="pointer-events-none absolute bottom-24 right-8 rounded-full border-2 border-ink bg-yel px-4 py-2 text-[13px] font-bold text-ink shadow-btn"
          >
            为街机爱好者而作 ♥
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.footer>
  );
}
