/**
 * CountdownOverlay —— 倒计时覆盖层（design.md §10.8）
 * 全屏 rgba(15,16,48,0.55) 背板；数字 KuaiLe 160px 白字 ink 描边：
 * 每拍 scale 2→1, opacity 0→1（ease-bounce 300ms）→ 停留 → scale 1→0.6 淡出；
 * 末拍 "GO!" 黄色 200px。
 *
 * 用法：父级每拍更新 value（3 → 2 → 1 → 'GO' → null 关闭），
 * 并在变化时播放 audio.playCountdownBeep() / playCountdownGo()。
 */

import { AnimatePresence, motion } from 'framer-motion';

export interface CountdownOverlayProps {
  /** 当前拍；null 时不渲染 */
  value: number | 'GO' | null;
}

export default function CountdownOverlay({ value }: CountdownOverlayProps) {
  return (
    <AnimatePresence>
      {value !== null ? (
        <motion.div
          key="countdown-backdrop"
          className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(15,16,48,0.55)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key={String(value)}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
              transition={{
                duration: 0.3,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className={
                value === 'GO'
                  ? 'font-display text-[200px] leading-none text-yel text-stroke-ink-lg'
                  : 'font-display text-[160px] leading-none text-white text-stroke-ink-lg'
              }
            >
              {value === 'GO' ? 'GO!' : value}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
