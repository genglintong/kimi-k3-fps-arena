/**
 * Results —— 比赛结算（/results，results.md）
 * 数据：localStorage 'gun-arena:match-results'（/play 在 END 时写入）；缺失/损坏 → 友好空态。
 * 结构：礼花/纸屑 Canvas → 胜负横幅 → 积分榜 → 个人数据卡 ×4 → 勋章条 → 操作区。
 * 音效：进入按名次播胜利号角 / 下行滑音（尊重设置）；按钮 UI 音；Enter 再来一局 / Esc 回大厅。
 * 清理：GSAP（useGSAP/CountUp）自动回收；rAF、键盘监听、toast 定时器均在卸载时释放，页面可反复进入。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Home, RotateCcw } from 'lucide-react';
import ArenaButton from '@/components/arena/ArenaButton';
import ArenaPanel from '@/components/arena/ArenaPanel';
import ConfettiCanvas from '@/components/results/ConfettiCanvas';
import MedalBar from '@/components/results/MedalBar';
import Scoreboard from '@/components/results/Scoreboard';
import StatCards from '@/components/results/StatCards';
import VictoryBanner from '@/components/results/VictoryBanner';
import {
  buildShareText,
  computeMedals,
  loadMatchResult,
  pickVerdict,
  rankEntries,
} from '@/components/results/resultsData';
import { audio } from '@/game/audio';
import { loadSettings } from '@/game/settings';

const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as [number, number, number, number];
const EASE_SNAP = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ------------------------------------------------------------------ */
/* 空态：直接闯入 /results，没有战绩                                    */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="relative z-10 mx-auto grid w-full max-w-[640px] flex-1 place-items-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_BOUNCE }}
        className="w-full"
      >
        <ArenaPanel colorBar="#3EA6FF" contentClassName="p-10 text-center">
          <img
            src="/trophy.svg"
            alt="奖杯"
            draggable={false}
            className="mx-auto h-28 w-28 opacity-60 saturate-50"
          />
          <h1 className="mt-6 font-display text-4xl text-txt text-stroke-ink sm:text-5xl">
            战绩还在路上…
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-txt-mute">
            结算室里还没有你的战绩——先去竞技场打一场，再回来风风光光地领奖吧！
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <ArenaButton to="/" variant="primary" size="lg" icon={<Home size={24} />}>
              返回大厅
            </ArenaButton>
            <ArenaButton to="/play" variant="ghost" size="md">
              直接开战
            </ArenaButton>
          </div>
        </ArenaPanel>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function Results() {
  const navigate = useNavigate();
  const result = useMemo(() => loadMatchResult(), []);
  const [warp, setWarp] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const data = useMemo(() => {
    if (!result) return null;
    const ranked = rankEntries(result.entries);
    const player = ranked.find((e) => e.id === result.playerId) ?? null;
    if (!player) return null;
    const maxDamage = Math.max(...ranked.map((e) => e.damage));
    const isTopDamage = player.damage === maxDamage && maxDamage > 0;
    return {
      ranked,
      player,
      maxDamage,
      durationS: result.durationS,
      overtime: result.overtime,
      verdict: pickVerdict(player, isTopDamage, result.endedAt),
      medals: computeMedals(ranked, player),
    };
  }, [result]);

  /* 进场号角 / 滑音：只播一次；先同步设置以尊重音效开关与音量 */
  useEffect(() => {
    if (!data) return;
    const s = loadSettings();
    audio.setEnabled(s.sound);
    audio.setVolume(s.volume);
    if (data.player.rank === 1) audio.playVictory();
    else audio.playDefeat();
  }, [data]);

  /* toast 定时器清理 */
  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  /* 再来一局：确认音 → 圆形扩散转场 → /play */
  const playAgain = useCallback((x: number, y: number) => {
    audio.unlock();
    audio.playConfirm();
    setWarp({ x, y });
  }, []);

  /* 键盘：Enter = 再来一局，Esc = 返回大厅 */
  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, [role="button"]')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        playAgain(window.innerWidth / 2, window.innerHeight / 2);
      } else if (e.key === 'Escape') {
        audio.playUiClick();
        navigate('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, navigate, playAgain]);

  const copyResults = async () => {
    if (!data) return;
    const text = buildShareText(data.player, data.ranked.length);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 剪贴板 API 不可用（非安全上下文等）时的退化方案
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* 静默失败，toast 照常提示 */
      }
      document.body.removeChild(ta);
    }
    audio.playConfirm();
    setToast(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(false), 2000);
  };

  if (!data) return <EmptyState />;

  const { ranked, player } = data;
  const lost = player.rank >= 4;

  return (
    <div className="relative flex-1">
      {/* 氛围层：礼花（前三）/ 灰色纸屑（战败） */}
      <ConfettiCanvas mode={player.rank <= 3 ? 'fireworks' : 'ashes'} />

      {/* 圆形扩散转场（→ /play） */}
      {warp ? (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed z-[99] rounded-full bg-yel"
          style={{ left: warp.x - 40, top: warp.y - 40, width: 80, height: 80 }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 45 }}
          transition={{ duration: 0.6, ease: EASE_SNAP }}
          onAnimationComplete={() => navigate('/play')}
        />
      ) : null}

      {/* 复制成功 toast */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key="toast"
            role="status"
            className="fixed bottom-8 left-1/2 z-[100] flex h-12 items-center gap-2 rounded-full border-[3px] border-ink bg-yel px-5 font-head text-lg tracking-[0.06em] text-ink shadow-btn"
            initial={{ opacity: 0, y: 40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 40, x: '-50%' }}
            transition={{ duration: 0.3, ease: EASE_BOUNCE }}
          >
            <Check size={20} strokeWidth={3} />
            已复制！
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 mx-auto w-full max-w-[928px] px-6">
        <VictoryBanner player={player} total={ranked.length} verdict={data.verdict} />

        <Scoreboard ranked={ranked} durationS={data.durationS} overtime={data.overtime} />

        <StatCards player={player} maxDamage={data.maxDamage} />

        <MedalBar medals={data.medals} />

        {/* 操作区 */}
        <div className="mt-12 flex flex-col items-center pb-[72px]">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 1.9, ease: EASE_SNAP }}
            >
              <ArenaButton
                size="xl"
                sound={false}
                onClick={(e) => playAgain(e.clientX, e.clientY)}
                className="animate-cta-breathe"
                icon={<RotateCcw size={28} strokeWidth={2.6} />}
                aria-label="再来一局"
              >
                {lost ? '再打一局，雪耻！' : '再来一局'}
              </ArenaButton>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 2.0, ease: EASE_SNAP }}
            >
              <ArenaButton to="/" variant="ghost" size="md" icon={<Home size={20} />}>
                返回大厅
              </ArenaButton>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 2.1, ease: EASE_SNAP }}
            >
              <ArenaButton
                variant="secondary"
                size="md"
                icon={<Copy size={20} />}
                onClick={copyResults}
                aria-label="复制战绩"
              >
                复制战绩
              </ArenaButton>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 2.25 }}
            className="mt-6"
          >
            <Link
              to="/armory"
              onMouseEnter={() => audio.playUiHover()}
              className="text-[13px] font-medium tracking-[0.04em] text-txt-dim underline-offset-4 transition-colors duration-120 hover:text-blu hover:underline"
            >
              去武器库练练枪，下局打回来 →
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
