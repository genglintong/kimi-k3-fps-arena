/**
 * Home —— 开始菜单（home.md）
 * Hero（Logo + 标语 + CTA + 插画）→ 对战设置条 → 武器速览 → 操作提示卡。
 * 设置抽屉与页脚由 Layout 挂载。对战配置持久化 localStorage（game 页读取）。
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Crosshair, Skull, Target, Timer, Zap } from 'lucide-react';
import ArenaButton from '@/components/arena/ArenaButton';
import ArenaPanel from '@/components/arena/ArenaPanel';
import Chip from '@/components/arena/Chip';
import KeyCap from '@/components/arena/KeyCap';
import { audio } from '@/game/audio';
import {
  BOT_COUNT_OPTIONS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  WEAPONS,
  WEAPON_ORDER,
} from '@/game/constants';
import type { BotCount, Difficulty, WeaponDef } from '@/game/constants';
import { loadMatchConfig, saveMatchConfig } from '@/game/settings';
import { cn } from '@/lib/utils';

gsap.registerPlugin(useGSAP);

const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as [number, number, number, number];
const EASE_SNAP = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ------------------------------------------------------------------ */
/* 背景：涂鸦视差层 + 漂浮几何装饰                                       */
/* ------------------------------------------------------------------ */

function DoodleParallax() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 16;
      ty = (e.clientY / window.innerHeight - 0.5) * 16;
    };
    const loop = () => {
      cx += (tx - cx) * 0.05;
      cy += (ty - cy) * 0.05;
      el.style.transform = `translate(${cx}px, ${cy}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="bg-doodle pointer-events-none fixed -inset-6 z-0 opacity-[0.06]"
    />
  );
}

const DECORATIONS: { style: React.CSSProperties; duration: string; delay: string; node: React.ReactNode }[] = [
  {
    style: { left: '4%', top: '14%' },
    duration: '6s',
    delay: '0s',
    node: (
      <svg width="96" height="96" viewBox="0 0 24 24" fill="#FFC831">
        <path d="M12 1l2.6 7.2L22 9.3l-6 5.1 2 7.6-6-4.4-6 4.4 2-7.6-6-5.1 7.4-1.1z" />
      </svg>
    ),
  },
  {
    style: { right: '6%', top: '10%' },
    duration: '7s',
    delay: '0.8s',
    node: (
      <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#3EA6FF" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    style: { left: '8%', bottom: '18%' },
    duration: '8s',
    delay: '1.6s',
    node: (
      <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#FF5A5F" strokeWidth="1.6">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 1v6M12 17v6M1 12h6M17 12h6" />
      </svg>
    ),
  },
  {
    style: { right: '10%', bottom: '24%' },
    duration: '9s',
    delay: '2.4s',
    node: (
      <svg width="90" height="90" viewBox="0 0 24 24" fill="#9B5CFF">
        <path d="M12 3l10 18H2z" />
      </svg>
    ),
  },
  {
    style: { left: '42%', top: '6%' },
    duration: '7.5s',
    delay: '3.2s',
    node: (
      <svg width="80" height="80" viewBox="0 0 24 24" fill="#FF8A3D">
        <path d="M13 1L4 14h6l-1 9 9-13h-6z" />
      </svg>
    ),
  },
  {
    style: { right: '34%', bottom: '8%' },
    duration: '8.5s',
    delay: '4s',
    node: (
      <svg width="100" height="100" viewBox="0 0 60 60" fill="#3ED97E">
        <circle cx="10" cy="10" r="4" />
        <circle cx="32" cy="6" r="3" />
        <circle cx="50" cy="16" r="5" />
        <circle cx="18" cy="34" r="3.4" />
        <circle cx="42" cy="40" r="4.4" />
        <circle cx="26" cy="54" r="3" />
      </svg>
    ),
  },
];

const FloatingDecor = function FloatingDecor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 hidden lg:block">
      {DECORATIONS.map((d, i) => (
        <div
          key={i}
          className="animate-float absolute opacity-25"
          style={{ ...d.style, animationDuration: d.duration, animationDelay: d.delay }}
        >
          {d.node}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 分段选择器胶囊                                                       */
/* ------------------------------------------------------------------ */

function Seg({
  selected,
  color,
  onClick,
  children,
}: {
  selected: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        audio.playUiClick();
        onClick();
      }}
      animate={selected ? { scale: [0.9, 1] } : { scale: 1 }}
      transition={{ duration: 0.2, ease: EASE_BOUNCE }}
      className={cn(
        'h-11 rounded-full border-[3px] px-5 font-head text-lg tracking-wide transition-colors duration-150',
        selected
          ? 'border-ink text-ink shadow-[0_4px_0_#14122E]'
          : 'border-transparent bg-bg-panel-2 text-txt-mute hover:text-txt',
      )}
      style={selected ? { backgroundColor: color ?? '#FFC831' } : undefined}
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* 武器速览卡                                                           */
/* ------------------------------------------------------------------ */

function WeaponCard({ weapon, index, onClick }: { weapon: WeaponDef; index: number; onClick: () => void }) {
  const stats: { label: string; dots: number }[] = [
    { label: '伤害', dots: weapon.statDots.damage },
    { label: '射速', dots: weapon.statDots.fireRate },
    { label: '射程', dots: weapon.statDots.range },
  ];
  return (
    <motion.div
      initial={{ y: 48, scale: 0.92, opacity: 0 }}
      whileInView={{ y: 0, scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: EASE_BOUNCE }}
      whileHover={{ y: -8, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
      className="w-[72vw] shrink-0 snap-center sm:w-[46vw] lg:w-auto"
    >
      <ArenaPanel
        colorBar={weapon.color}
        onClick={onClick}
        className="group h-full transition-shadow duration-200 hover:shadow-[0_20px_44px_rgba(8,6,40,0.6)]"
        contentClassName="flex h-full flex-col p-6"
      >
        <img
          src={weapon.image}
          alt={weapon.name}
          draggable={false}
          className="mx-auto h-28 w-auto transition-transform duration-200 group-hover:scale-110"
        />
        <div className="mt-4 text-center">
          <span className="font-head text-[26px] text-txt">{weapon.name}</span>
          <span className="ml-2 font-num text-[13px]" style={{ color: weapon.color }}>
            {weapon.nameEn}
          </span>
        </div>
        <p className="mt-1 text-center text-[13px] text-txt-mute">{weapon.tagline}</p>
        <div className="mt-4 space-y-2">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-txt-dim">{s.label}</span>
              <span className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: i < s.dots ? weapon.color : '#2B2F6B' }}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      </ArenaPanel>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 鼠标线稿（操作提示卡用）                                              */
/* ------------------------------------------------------------------ */

function MouseSketch() {
  return (
    <svg width="72" height="96" viewBox="0 0 72 96" fill="none" aria-hidden>
      <rect x="10" y="6" width="52" height="84" rx="26" stroke="#fff" strokeWidth="4" />
      <path d="M36 6v30" stroke="#fff" strokeWidth="4" />
      <path d="M10 36h52" stroke="#fff" strokeWidth="4" />
      <path d="M12 34V30A24 24 0 0 1 34 7.2V34z" fill="#FF5A5F" opacity="0.9" />
      <circle cx="23" cy="20" r="4" fill="#fff" className="animate-dot-blink" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */

export default function Home() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const [config, setConfig] = useState(() => loadMatchConfig());
  const [warp, setWarp] = useState<{ x: number; y: number } | null>(null);

  const updateConfig = (patch: Partial<typeof config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveMatchConfig(next);
  };

  /* Hero 首屏 GSAP 时间线（home.md §3；进入 /play 前自动 kill） */
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
      tl.fromTo(
        '.hero-eyebrow',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
        0.1,
      )
        .fromTo(
          '.hero-logo',
          { scale: 0.6, rotate: 8, opacity: 0 },
          { scale: 1, rotate: -2, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' },
          0.2,
        )
        .fromTo(
          '.hero-word',
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out' },
          0.5,
        )
        .fromTo('.hero-sub', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.7)
        .fromTo(
          '.hero-cta',
          { scale: 0, opacity: 1 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' },
          0.8,
        )
        .fromTo(
          '.hero-ghost',
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.1, ease: 'back.out(1.7)' },
          0.9,
        )
        .fromTo(
          '.hero-art',
          { x: 80, opacity: 0, rotate: 3 },
          { x: 0, opacity: 1, rotate: 0, duration: 0.7, ease: 'power3.out' },
          0.6,
        );
      return () => {
        tl.kill();
      };
    },
    { scope: heroRef },
  );

  /** 开始战斗：确认音 → 圆形扩散 → /play */
  const startBattle = (e: React.MouseEvent) => {
    audio.unlock();
    audio.playConfirm();
    setWarp({ x: e.clientX, y: e.clientY });
  };

  const taglineWords: { text: string; gold?: boolean }[] = [
    { text: '3 分钟' },
    { text: '·' },
    { text: '5 个机器人' },
    { text: '·' },
    { text: '只有 1 个' },
    { text: '枪王', gold: true },
  ];

  return (
    <div className="relative flex-1 overflow-x-clip">
      <DoodleParallax />
      <FloatingDecor />
      {/* 底部收边渐变 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-60 bg-[linear-gradient(180deg,transparent,rgba(15,16,48,0.8))]"
      />

      {/* 圆形扩散转场 */}
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

      {/* ============ Hero ============ */}
      <section
        ref={heroRef}
        className="relative z-10 mx-auto grid min-h-[calc(100dvh-64px)] w-full max-w-[1280px] items-center gap-10 px-6 py-10 lg:grid-cols-12"
      >
        {/* 左栏 */}
        <div className="space-y-6 lg:col-span-7">
          <div className="hero-eyebrow opacity-0">
            <Chip color="#FF5A5F">实时对战 · 无需登录 · 打开即玩</Chip>
          </div>

          <img
            src="/logo.svg"
            alt="枪火竞技场 GUN ARENA"
            draggable={false}
            className="hero-logo w-[clamp(360px,34vw,560px)] max-w-full opacity-0"
          />

          <h2 className="font-head text-[clamp(28px,3.4vw,40px)] leading-snug tracking-wide text-txt">
            {taglineWords.map((w, i) => (
              <span
                key={i}
                className={cn(
                  'hero-word mr-3 inline-block opacity-0 last:mr-0',
                  w.gold && 'text-yel text-[1.15em]',
                )}
              >
                {w.text}
              </span>
            ))}
          </h2>

          <p className="hero-sub max-w-xl text-lg leading-relaxed text-txt-mute opacity-0">
            WASD 走位，鼠标开火。捡武器、抢护盾、卡掩体——在时间耗尽前拿下最多击杀！
          </p>

          <div className="pt-2">
            <div className="hero-cta inline-block opacity-0">
              <ArenaButton
                size="xl"
                sound={false}
                onClick={startBattle}
                className="animate-cta-breathe w-full sm:w-auto"
                icon={<Crosshair size={30} strokeWidth={2.6} />}
              >
                开始战斗
              </ArenaButton>
            </div>
            <p className="mt-3 text-[13px] text-txt-dim">点击后 3 秒倒计时进场</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="hero-ghost opacity-0">
              <ArenaButton to="/armory" variant="ghost" className="w-full sm:w-auto">
                武器图鉴
              </ArenaButton>
            </div>
            <div className="hero-ghost opacity-0">
              <ArenaButton to="/guide" variant="ghost" className="w-full sm:w-auto">
                怎么玩？
              </ArenaButton>
            </div>
          </div>
        </div>

        {/* 右栏插画 */}
        <div className="hero-art relative opacity-0 lg:col-span-5">
          <img
            src="/menu-hero.svg"
            alt="竞技场激战插画"
            draggable={false}
            className="mx-auto h-64 w-full max-w-[640px] object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.4)] lg:h-auto"
          />
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="animate-float absolute -left-2 top-6 h-6 w-6 text-yel"
            style={{ animationDuration: '6s' }}
            fill="currentColor"
          >
            <path d="M12 1l2.6 7.2L22 9.3l-6 5.1 2 7.6-6-4.4-6 4.4 2-7.6-6-5.1 7.4-1.1z" />
          </svg>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="animate-float absolute -right-1 bottom-8 h-8 w-8 text-yel"
            style={{ animationDuration: '7.5s', animationDelay: '1.2s' }}
            fill="currentColor"
          >
            <path d="M12 1l2.6 7.2L22 9.3l-6 5.1 2 7.6-6-4.4-6 4.4 2-7.6-6-5.1 7.4-1.1z" />
          </svg>
        </div>
      </section>

      {/* ============ 对战设置条 ============ */}
      <motion.section
        initial={{ y: 40, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: EASE_SNAP }}
        className="relative z-10 mx-auto w-full max-w-[1280px] px-6 pb-20"
      >
        <ArenaPanel contentClassName="flex min-h-24 flex-wrap items-center gap-x-10 gap-y-5 px-8 py-5">
          <div className="flex items-center gap-4">
            <span className="font-head text-[26px] text-txt">机器人</span>
            <div className="flex gap-2">
              {BOT_COUNT_OPTIONS.map((n: BotCount) => (
                <Seg key={n} selected={config.botCount === n} onClick={() => updateConfig({ botCount: n })}>
                  {n}
                </Seg>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-head text-[26px] text-txt">难度</span>
            <div className="flex gap-2">
              {DIFFICULTY_ORDER.map((d: Difficulty) => (
                <Seg
                  key={d}
                  selected={config.difficulty === d}
                  color={DIFFICULTIES[d].color}
                  onClick={() => updateConfig({ difficulty: d })}
                >
                  {DIFFICULTIES[d].name}
                </Seg>
              ))}
            </div>
          </div>

          <motion.div
            key={`${config.botCount}-${config.difficulty}`}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-txt-mute"
          >
            <span className="flex items-center gap-1.5">
              <Timer size={16} className="text-yel" /> 3 分钟
            </span>
            <span className="hidden text-txt-dim sm:inline">｜</span>
            <span className="flex items-center gap-1.5">
              <Target size={16} className="text-red" /> 击杀计分
            </span>
            <span className="hidden text-txt-dim sm:inline">｜</span>
            <span className="flex items-center gap-1.5">
              <Skull size={16} className="text-pur" /> 死亡 3 秒重生
            </span>
          </motion.div>
        </ArenaPanel>
      </motion.section>

      {/* ============ 武器速览 ============ */}
      <section className="relative z-10 mx-auto w-full max-w-[1280px] px-6 pb-24">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: EASE_SNAP }}
          className="text-center"
        >
          <h2 className="font-head text-[clamp(30px,3.6vw,40px)] tracking-wide text-txt">今天用哪把？</h2>
          <p className="mt-2 text-[13px] text-txt-mute">点击卡片查看完整图鉴</p>
        </motion.div>
        <div className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {WEAPON_ORDER.map((id, i) => (
            <WeaponCard
              key={id}
              weapon={WEAPONS[id]}
              index={i}
              onClick={() => {
                audio.playUiClick();
                navigate('/armory');
              }}
            />
          ))}
        </div>
      </section>

      {/* ============ 操作提示卡 ============ */}
      <motion.section
        initial={{ y: 40, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: EASE_SNAP }}
        className="relative z-10 mx-auto w-full max-w-[1280px] px-6 pb-24"
      >
        <ArenaPanel
          onClick={() => {
            audio.playUiClick();
            navigate('/guide');
          }}
          contentClassName="grid items-center gap-8 p-8 md:grid-cols-[1fr_auto_1fr] md:p-10"
        >
          <div className="group flex items-center gap-6">
            <div className="grid grid-cols-3 gap-2 transition-transform duration-200 group-hover:scale-105">
              <span />
              <KeyCap label="W" pulse pulseDelay={0} />
              <span />
              <KeyCap label="A" pulse pulseDelay={150} />
              <KeyCap label="S" pulse pulseDelay={300} />
              <KeyCap label="D" pulse pulseDelay={450} />
            </div>
            <div>
              <h3 className="font-head text-[26px] text-txt">WASD 移动</h3>
              <p className="mt-1 text-[13px] text-txt-mute">灵活走位，绕开火线</p>
            </div>
          </div>

          <div aria-hidden className="hidden w-px self-stretch bg-line-soft md:block" />

          <div className="flex items-center gap-6 md:justify-end">
            <MouseSketch />
            <div>
              <h3 className="font-head text-[26px] text-txt">鼠标瞄准 · 左键射击</h3>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-txt-mute">
                <Zap size={13} className="text-yel" /> R 换弹 · 1-4 切枪 · Esc 暂停
              </p>
            </div>
          </div>
        </ArenaPanel>
      </motion.section>
    </div>
  );
}
