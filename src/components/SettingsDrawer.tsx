/**
 * SettingsDrawer —— 设置抽屉（home.md §8，全局共享：Layout 挂载）
 * 右侧滑出 400px ArenaPanel（圆角只留左侧 20px），背板 rgba(15,16,48,0.6) + blur。
 * 内容：音效（Toggle + 音量滑杆）/ 屏幕震动 / 伤害数字 / 击杀播报 / 恢复默认。
 * 全部设置持久化 localStorage（src/game/settings.ts）。
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import ArenaButton from '@/components/arena/ArenaButton';
import Toggle from '@/components/arena/Toggle';
import { audio } from '@/game/audio';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  updateSettings,
  SETTINGS_EVENT,
} from '@/game/settings';
import type { ArenaSettings } from '@/game/settings';

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface RowProps {
  title: string;
  desc?: string;
  children: React.ReactNode;
}

function Row({ title, desc, children }: RowProps) {
  return (
    <motion.div
      variants={{ hidden: { x: 24, opacity: 0 }, show: { x: 0, opacity: 1 } }}
      className="flex items-center justify-between gap-4 py-4"
    >
      <div>
        <div className="text-base font-bold text-txt">{title}</div>
        {desc ? <div className="mt-0.5 text-[13px] text-txt-dim">{desc}</div> : null}
      </div>
      {children}
    </motion.div>
  );
}

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [settings, setSettings] = useState<ArenaSettings>(() => loadSettings());

  // 外部（Navbar 音效键等）修改时同步
  useEffect(() => {
    const onChanged = () => setSettings(loadSettings());
    window.addEventListener(SETTINGS_EVENT, onChanged);
    return () => window.removeEventListener(SETTINGS_EVENT, onChanged);
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const apply = (patch: Partial<ArenaSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.sound !== undefined) audio.setEnabled(patch.sound);
    if (patch.volume !== undefined) audio.setVolume(patch.volume);
    updateSettings(next);
  };

  const reset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    audio.setEnabled(DEFAULT_SETTINGS.sound);
    audio.setVolume(DEFAULT_SETTINGS.volume);
    updateSettings({ ...DEFAULT_SETTINGS });
    audio.playUiClick();
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[95] bg-[rgba(15,16,48,0.6)] backdrop-blur-sm"
          />
          <motion.aside
            key="settings-panel"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400, transition: { duration: 0.3, ease: 'easeIn' } }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 z-[100] flex h-full w-[400px] max-w-[92vw] flex-col border-l-2 border-white/10 bg-bg-panel panel-highlight"
            role="dialog"
            aria-label="设置"
          >
            <div className="flex items-center justify-between border-b border-line-soft px-8 py-6">
              <h2 className="font-head text-[32px] tracking-wide text-txt">设置</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭设置"
                className="grid h-10 w-10 place-items-center rounded-full border border-line-soft bg-bg-panel-2 text-txt-mute transition-all hover:scale-105 hover:text-txt active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              className="flex-1 divide-y divide-line-soft/50 overflow-y-auto px-8"
            >
              <Row title="音效" desc="合成音效总开关">
                <Toggle
                  checked={settings.sound}
                  onChange={(v) => apply({ sound: v })}
                  aria-label="音效开关"
                />
              </Row>

              <Row title="音量" desc={`${settings.volume}`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.volume}
                  aria-label="音量"
                  onChange={(e) => apply({ volume: Number(e.target.value) })}
                  onPointerUp={() => audio.playUiClick()}
                  className="arena-slider w-36"
                  style={{
                    background: `linear-gradient(to right, #FFC831 0%, #FFC831 ${settings.volume}%, #15173D ${settings.volume}%, #15173D 100%)`,
                  }}
                />
              </Row>

              <Row title="屏幕震动" desc="受击与爆炸时的镜头抖动">
                <Toggle
                  checked={settings.shake}
                  onChange={(v) => apply({ shake: v })}
                  aria-label="屏幕震动开关"
                />
              </Row>

              <Row title="伤害数字" desc="命中时飘出伤害值">
                <Toggle
                  checked={settings.damageNumbers}
                  onChange={(v) => apply({ damageNumbers: v })}
                  aria-label="伤害数字开关"
                />
              </Row>

              <Row title="击杀播报" desc="右上角击杀信息流">
                <Toggle
                  checked={settings.killFeed}
                  onChange={(v) => apply({ killFeed: v })}
                  aria-label="击杀播报开关"
                />
              </Row>

              <motion.div
                variants={{ hidden: { x: 24, opacity: 0 }, show: { x: 0, opacity: 1 } }}
                className="py-6"
              >
                <ArenaButton variant="danger" size="sm" sound={false} onClick={reset}>
                  恢复默认
                </ArenaButton>
              </motion.div>
            </motion.div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
