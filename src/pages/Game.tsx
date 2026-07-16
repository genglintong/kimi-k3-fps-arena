/**
 * /play 对战页（game.md）：Canvas 引擎 + DOM HUD + 状态覆盖层。
 * 移动端（<1024px 或触屏无键盘）显示设备提示层，不启动比赛。
 * 比赛结束写入 localStorage['gun-arena:match-results'] 并跳转 /results。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { CountdownOverlay, AnnouncementBanner } from '@/components/arena';
import type { AnnouncementTone } from '@/components/arena';
import { GameEngine } from '@/game/engine';
import type { EngineEvent, HudSnapshot, MatchResults } from '@/game/engine';
import { loadMatchConfig, loadSettings, updateSettings } from '@/game/settings';
import type { ArenaSettings } from '@/game/settings';
import { audio } from '@/game/audio';
import {
  HudStyles,
  TimerHud,
  PlayerCard,
  Scoreboard,
  KillFeed,
  WeaponSlots,
  DeathOverlay,
  PauseOverlay,
  TimeUpBanner,
  ScreenFx,
  DeviceBlock,
  BannerConfetti,
} from '@/game/hud';
import type { FeedItem } from '@/game/hud';

/** 结果页契约键（constants.STORAGE_KEYS 未定义结果键，按任务约定使用本键） */
const RESULTS_KEY = 'gun-arena:match-results';

function isDeviceBlocked(): boolean {
  const narrow = window.innerWidth < 1024;
  const touchNoKeyboard =
    navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
  return narrow || touchNoKeyboard;
}

interface AnnounceItem {
  title: string;
  subtitle?: string;
  tone: AnnouncementTone;
  confetti?: boolean;
}

export default function Game() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const settingsRef = useRef<ArenaSettings>(loadSettings());
  const announceQueueRef = useRef<AnnounceItem[]>([]);
  const feedIdRef = useRef(0);

  const [blocked, setBlocked] = useState<boolean>(() => isDeviceBlocked());
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [settings, setSettings] = useState<ArenaSettings>(settingsRef.current);
  const [cd, setCd] = useState<3 | 2 | 1 | 'GO' | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [announce, setAnnounce] = useState<AnnounceItem | null>(null);
  const [hitTick, setHitTick] = useState(0);
  const [pulseTick, setPulseTick] = useState(0);
  const [confettiTick, setConfettiTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timeUp, setTimeUp] = useState('');
  const [leaving, setLeaving] = useState(false);

  /* ---------- 播报队列：每条驻留 1.2s ---------- */
  useEffect(() => {
    if (announce === null) {
      const next = announceQueueRef.current.shift();
      if (next) setAnnounce(next);
      return;
    }
    const t = window.setTimeout(() => setAnnounce(null), 1250);
    return () => window.clearTimeout(t);
  }, [announce]);

  const pushAnnounce = useCallback((item: AnnounceItem) => {
    const q = announceQueueRef.current;
    if (q.length >= 4) {
      // 队列过长时丢弃最旧的普通播报（保留 confetti 重要播报）
      const idx = q.findIndex((x) => !x.confetti);
      q.splice(idx === -1 ? 0 : idx, 1);
    }
    q.push(item);
    setAnnounce((cur) => {
      if (cur === null) return announceQueueRef.current.shift() ?? null;
      return cur;
    });
  }, []);

  /* ---------- 事件分发（稳定引用） ---------- */
  const handleEvent = useCallback(
    (e: EngineEvent) => {
      switch (e.type) {
        case 'countdown':
          setCd(e.value);
          break;
        case 'kill': {
          if (!settingsRef.current.killFeed) break;
          const id = ++feedIdRef.current;
          setFeed((prev) => [
            ...prev.slice(-4),
            {
              id,
              killerName: e.killerName,
              killerColor: e.killerColor,
              victimName: e.victimName,
              victimColor: e.victimColor,
              weapon: e.weapon,
              highlight: e.involvesPlayer,
            },
          ]);
          window.setTimeout(() => {
            setFeed((prev) => prev.filter((x) => x.id !== id));
          }, 4000);
          break;
        }
        case 'announce':
          pushAnnounce(e);
          if (e.confetti) setConfettiTick((t) => t + 1);
          break;
        case 'playerHit':
          setHitTick((t) => t + 1);
          break;
        case 'weaponPickup':
          setPulseTick((t) => t + 1);
          break;
        case 'ammoDepleted':
          pushAnnounce({ title: `${e.name} 弹尽，切回手枪`, tone: 'gray' });
          break;
        case 'paused':
          setPaused(e.paused);
          break;
        case 'timeUp':
          setTimeUp(e.title);
          break;
        case 'finished': {
          try {
            localStorage.setItem(RESULTS_KEY, JSON.stringify(e.results satisfies MatchResults));
          } catch {
            /* 隐私模式静默失败 */
          }
          setLeaving(true);
          window.setTimeout(() => navigate('/results'), 700);
          break;
        }
        default:
          break;
      }
    },
    [navigate, pushAnnounce],
  );
  const handleEventRef = useRef(handleEvent);
  handleEventRef.current = handleEvent;

  /* ---------- 设备拦截监听 ---------- */
  useEffect(() => {
    const onResize = () => setBlocked(isDeviceBlocked());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ---------- 引擎生命周期 ---------- */
  useEffect(() => {
    if (blocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const config = loadMatchConfig();
    const s = loadSettings();
    settingsRef.current = s;
    setSettings(s);
    audio.setEnabled(s.sound);
    audio.setVolume(s.volume);
    audio.unlock();

    const engine = new GameEngine({
      canvas,
      config,
      settings: s,
      onEvent: (e) => handleEventRef.current(e),
    });
    engineRef.current = engine;
    void engine.start();
    // HUD 轮询 100ms（game.md §13：HP 每 100ms；计时显示秒）
    const poll = window.setInterval(() => setHud(engine.getHud()), 100);
    return () => {
      window.clearInterval(poll);
      engine.destroy();
      engineRef.current = null;
    };
  }, [blocked]);

  /* ---------- 设置应用（暂停层） ---------- */
  const applySettings = useCallback((patch: Partial<ArenaSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    if (patch.sound !== undefined) audio.setEnabled(patch.sound);
    if (patch.volume !== undefined) audio.setVolume(patch.volume);
    engineRef.current?.applySettings(next);
    updateSettings(next);
  }, []);

  const resume = useCallback(() => engineRef.current?.resume(), []);
  const quitToMenu = useCallback(() => {
    audio.playUiClick();
    navigate('/');
  }, [navigate]);

  /* ---------------------------------------------------------------- */

  if (blocked) {
    return (
      <>
        <HudStyles />
        <DeviceBlock />
      </>
    );
  }

  const loading = hud === null || hud.phase === 'loading';

  return (
    <div className="fixed inset-0 cursor-none overflow-hidden bg-void">
      <HudStyles />
      {/* L0 画布 */}
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
      />

      {/* L1 HUD（pointer-events:none） */}
      {hud && !loading ? (
        <>
          <TimerHud hud={hud} />
          <PlayerCard hud={hud} hitTick={hitTick} />
          <Scoreboard hud={hud} ended={hud.phase === 'end' || hud.phase === 'done'} />
          <KillFeed items={feed} />
          <WeaponSlots hud={hud} pulseTick={pulseTick} />
          <ScreenFx hud={hud} hitTick={hitTick} />
          <DeathOverlay hud={hud} />
          {hud.phase === 'live' && !hud.paused ? (
            <button
              type="button"
              onClick={() => engineRef.current?.togglePause()}
              className="pointer-events-auto fixed bottom-4 right-4 z-10 cursor-pointer rounded-full border-2 border-white/15 bg-bg-panel/70 px-4 py-1.5 text-[12px] font-bold text-txt-mute backdrop-blur-sm transition-colors hover:text-txt"
            >
              ESC 暂停
            </button>
          ) : null}
        </>
      ) : null}

      {/* 加载态（字体/资源就绪） */}
      {loading ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-bg-deep">
          <div className="text-center">
            <div
              aria-hidden
              className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-line-soft border-t-yel"
            />
            <h1 className="font-display text-5xl text-txt text-stroke-ink">对战加载中…</h1>
            <p className="mt-4 text-sm text-txt-mute">
              {loadMatchConfig().botCount} 个机器人 · 3 分钟击杀赛
            </p>
          </div>
        </div>
      ) : null}

      {/* L2 状态覆盖 */}
      <CountdownOverlay value={loading ? null : cd} />
      <AnimatePresence>
        {announce ? (
          <AnnouncementBanner
            key={`${announce.title}-${announce.subtitle ?? ''}`}
            title={announce.title}
            subtitle={announce.subtitle}
            tone={announce.tone}
          />
        ) : null}
      </AnimatePresence>
      <BannerConfetti tick={confettiTick} />
      <TimeUpBanner title={timeUp} show={timeUp !== '' && !leaving} />
      <div className="cursor-auto">
        <PauseOverlay
          open={paused}
          settings={settings}
          onApply={applySettings}
          onResume={resume}
          onQuit={quitToMenu}
        />
      </div>

      {/* L3 对角条纹转场 → /results */}
      <AnimatePresence>
        {leaving ? (
          <>
            <motion.div
              key="stripe-yel"
              initial={{ x: '-130%', skewX: -14 }}
              animate={{ x: '0%', skewX: -14 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[60] scale-125 bg-yel"
            />
            <motion.div
              key="stripe-blu"
              initial={{ x: '-130%', skewX: -14 }}
              animate={{ x: '0%', skewX: -14 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[61] scale-125 bg-blu"
            />
            <motion.div
              key="stripe-ink"
              initial={{ x: '-130%', skewX: -14 }}
              animate={{ x: '0%', skewX: -14 }}
              transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[62] scale-125 bg-bg-deep"
            />
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
