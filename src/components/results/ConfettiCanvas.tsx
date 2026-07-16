/**
 * ConfettiCanvas —— 结算页氛围层（results.md §1）
 * fireworks：前三名的礼花（每 700ms 一发，升空爆 28 粒，8s 后停止发射，余烬落尽后停帧）
 * ashes：第 4 名+ 的灰色小纸屑缓慢飘落（幽默哀悼感，循环至页面卸载）
 * 全屏 pointer-events-none，自包含；卸载时取消 rAF 与监听，可反复进入。
 */

import { useEffect, useRef } from 'react';

export type ConfettiMode = 'fireworks' | 'ashes';

const PALETTE = ['#FFC831', '#3EA6FF', '#FF5A5F', '#3ED97E'];
const MAX_ROCKETS = 5;
const LAUNCH_EVERY_MS = 700;
const LAUNCH_WINDOW_MS = 8000;
const EXPLODE_COUNT = 28;
const GRAVITY = 320;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  hue: string;
}

interface Ash {
  x: number;
  y: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  sway: number;
  phase: number;
  alpha: number;
}

export default function ConfettiCanvas({ mode }: { mode: ConfettiMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    const ashes: Ash[] = [];
    const start = performance.now();
    let lastLaunch = -LAUNCH_EVERY_MS; // 立即发射第一发
    let prev = start;

    if (mode === 'ashes') {
      for (let i = 0; i < 40; i++) {
        ashes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: 18 + Math.random() * 26,
          size: 3 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 1.4,
          sway: 14 + Math.random() * 26,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.16 + Math.random() * 0.22,
        });
      }
    }

    const explode = (x: number, y: number) => {
      for (let i = 0; i < EXPLODE_COUNT; i++) {
        const angle = (i / EXPLODE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 120 + Math.random() * 240;
        const life = 1.1 + Math.random() * 0.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          life,
          maxLife: life,
          size: 2.5 + Math.random() * 3,
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 8,
        });
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - prev) / 1000, 0.033);
      prev = now;
      ctx.clearRect(0, 0, w, h);

      if (mode === 'fireworks') {
        // 发射
        if (
          now - start < LAUNCH_WINDOW_MS &&
          now - lastLaunch >= LAUNCH_EVERY_MS &&
          rockets.length < MAX_ROCKETS
        ) {
          lastLaunch = now;
          rockets.push({
            x: w * (0.15 + Math.random() * 0.7),
            y: h + 12,
            vy: -(h * 0.72) / 0.8,
            targetY: h * (0.16 + Math.random() * 0.3),
            hue: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          });
        }
        // 火箭升空（0.8s 左右到达目标高度后爆炸）
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.y += r.vy * dt;
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = r.hue;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x, r.y + 16);
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (r.y <= r.targetY) {
            rockets.splice(i, 1);
            explode(r.x, r.y);
          }
        }
        // 爆点粒子：重力下落，寿命到时 scale→0
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life -= dt;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          p.vy += GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          const t = p.life / p.maxLife;
          const s = Math.max(0.05, t) * p.size;
          ctx.save();
          ctx.globalAlpha = Math.min(1, t * 1.6);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
          ctx.restore();
        }
        // 发射窗口结束且余烬落尽 → 停帧（不再消耗 rAF）
        if (now - start >= LAUNCH_WINDOW_MS && rockets.length === 0 && particles.length === 0) {
          ctx.clearRect(0, 0, w, h);
          running = false;
          return;
        }
      } else {
        // 灰色纸屑：缓慢飘落 + 左右摇摆 + 自转，落出底部回到顶部
        const t = now / 1000;
        for (const a of ashes) {
          a.y += a.vy * dt;
          a.x += Math.sin(t * 0.9 + a.phase) * a.sway * dt;
          a.rot += a.vr * dt;
          if (a.y > h + 12) {
            a.y = -12;
            a.x = Math.random() * w;
          }
          ctx.save();
          ctx.globalAlpha = a.alpha;
          ctx.translate(a.x, a.y);
          ctx.rotate(a.rot);
          ctx.fillStyle = '#B9BED6';
          ctx.fillRect(-a.size / 2, -a.size / 3, a.size, a.size * 0.66);
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
