/**
 * Layout —— 全局布局（children 插槽模式，与 App.tsx 的 <Layout><Routes/></Layout> 配套）
 * - 常规页面：Navbar（sticky）+ main 内容 + Footer + 全局设置抽屉
 * - /play：游戏页全屏，不渲染导航与页脚
 * 音频引擎在此做首次设置同步。
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SettingsDrawer from '@/components/SettingsDrawer';
import { audio } from '@/game/audio';
import { loadSettings } from '@/game/settings';

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isPlay = pathname.startsWith('/play');

  // 启动时把持久化设置同步到音频引擎
  useEffect(() => {
    const s = loadSettings();
    audio.setEnabled(s.sound);
    audio.setVolume(s.volume);
  }, []);

  if (isPlay) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
