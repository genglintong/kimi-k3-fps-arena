/**
 * 枪火竞技场 · WebAudio 合成音效引擎（design.md §9 / game.md §12）
 * 零音频文件，全部实时合成。
 * 总线：AudioContext → MasterGain(0.8 × volume) → DynamicsCompressor → destination
 * 分类增益：sfx 1.0 / ui 0.6 / jingle 0.8
 * AudioContext 在首次用户手势时惰性创建（浏览器自动播放策略）。
 */

import type { ItemType, WeaponId } from './constants';

type BusName = 'sfx' | 'ui' | 'jingle';

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  freqEnd?: number;
  dur: number; // 秒
  gain: number;
  bus: BusName;
  delay?: number; // 起始延迟（秒）
  attack?: number;
}

interface NoiseOpts {
  dur: number;
  gain: number;
  bus: BusName;
  delay?: number;
  filterType: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
}

const CATEGORY_GAIN: Record<BusName, number> = { sfx: 1.0, ui: 0.6, jingle: 0.8 };
const MASTER_BASE = 0.8;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<BusName, GainNode> | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private enabled = true;
  /** 0–100 */
  private volume = 80;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private gestureBound = false;

  /* ---------------- 基础 ---------------- */

  /** 首次用户手势时调用（或在任意点击处理中隐式调用） */
  unlock(): void {
    this.ensure();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? MASTER_BASE * (this.volume / 100) : 0, t, 0.02);
    }
    if (!on) this.stopHeartbeat();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(100, v));
    if (this.master && this.ctx && this.enabled) {
      this.master.gain.setTargetAtTime(MASTER_BASE * (this.volume / 100), this.ctx.currentTime, 0.02);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 24;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.24;
      compressor.connect(this.ctx.destination);

      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? MASTER_BASE * (this.volume / 100) : 0;
      this.master.connect(compressor);

      const busEntries = (Object.keys(CATEGORY_GAIN) as BusName[]).map((name) => {
        const g = this.ctx!.createGain();
        g.gain.value = CATEGORY_GAIN[name];
        g.connect(this.master!);
        return [name, g] as const;
      });
      this.buses = Object.fromEntries(busEntries) as Record<BusName, GainNode>;

      // 1s 白噪声缓存
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.gestureBound) {
      this.gestureBound = true;
      const resume = () => {
        if (this.ctx?.state === 'suspended') void this.ctx.resume();
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    }
    return this.ctx;
  }

  private ready(): boolean {
    if (!this.enabled) return false;
    return this.ensure() !== null;
  }

  /* ---------------- 合成原语 ---------------- */

  private tone(opts: ToneOpts): void {
    const ctx = this.ctx;
    const bus = this.buses?.[opts.bus];
    if (!ctx || !bus) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(1, opts.freq), t0);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t0 + opts.dur);
    }
    const g = ctx.createGain();
    const attack = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, opts.gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  private noise(opts: NoiseOpts): void {
    const ctx = this.ctx;
    const bus = this.buses?.[opts.bus];
    if (!ctx || !bus || !this.noiseBuf) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(10, opts.freqEnd), t0 + opts.dur);
    }
    filter.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, opts.gain), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  /** 干脆的"咔哒"声（换弹/空膛/UI） */
  private click(freq: number, durMs: number, gain: number, bus: BusName, delay = 0): void {
    this.tone({ type: 'square', freq, dur: durMs / 1000, gain, bus, delay, attack: 0.001 });
  }

  /* ---------------- UI 音（design.md §9） ---------------- */

  /** UI 点击：2000Hz 方波 30ms */
  playUiClick(): void {
    if (!this.ready()) return;
    this.click(2000, 30, 0.5, 'ui');
  }

  /** UI 悬停：1200Hz 20ms（-12dB） */
  playUiHover(): void {
    if (!this.ready()) return;
    this.click(1200, 20, 0.12, 'ui');
  }

  /** 主 CTA 确认音（明亮上行） */
  playConfirm(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.12, gain: 0.45, bus: 'ui' });
    this.tone({ type: 'sine', freq: 1320, dur: 0.18, gain: 0.2, bus: 'ui', delay: 0.06 });
  }

  /* ---------------- 武器射击（game.md §12） ---------------- */

  playShot(weapon: WeaponId): void {
    if (weapon === 'pistol') this.playShotPistol();
    else if (weapon === 'shotgun') this.playShotShotgun();
    else if (weapon === 'rifle') this.playShotRifle();
    else this.playShotSniper();
  }

  /** 手枪：方波 880→220Hz 指数下滑 + 高通噪声点缀，120ms */
  playShotPistol(): void {
    if (!this.ready()) return;
    this.tone({ type: 'square', freq: 880, freqEnd: 220, dur: 0.12, gain: 0.5, bus: 'sfx' });
    this.noise({ dur: 0.05, gain: 0.18, bus: 'sfx', filterType: 'highpass', freq: 2000 });
  }

  /** 步枪：锯齿 660→180Hz + 短噪声，80ms */
  playShotRifle(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sawtooth', freq: 660, freqEnd: 180, dur: 0.08, gain: 0.35, bus: 'sfx' });
    this.noise({ dur: 0.03, gain: 0.12, bus: 'sfx', filterType: 'highpass', freq: 1800 });
  }

  /** 霰弹枪：白噪声低通 800→200Hz 扫频 + 120Hz 低音炮，280ms */
  playShotShotgun(): void {
    if (!this.ready()) return;
    this.noise({
      dur: 0.28,
      gain: 0.8,
      bus: 'sfx',
      filterType: 'lowpass',
      freq: 800,
      freqEnd: 200,
    });
    this.tone({ type: 'sine', freq: 120, freqEnd: 60, dur: 0.22, gain: 0.55, bus: 'sfx' });
  }

  /** 狙击枪：90Hz 重低音 + 4kHz 起手裂响 + 0.15s 延迟回声，500ms */
  playShotSniper(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const bus = this.buses!.sfx;
    const t0 = ctx.currentTime;

    // 延迟回声通道
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.15;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.5;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(echoOut);
    echoOut.connect(bus);

    // 重低音
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t0);
    sub.frequency.exponentialRampToValueAtTime(45, t0 + 0.5);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t0);
    subGain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.008);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    sub.connect(subGain);
    subGain.connect(bus);
    subGain.connect(delay);
    sub.start(t0);
    sub.stop(t0 + 0.6);

    // 起手裂响
    this.noise({ dur: 0.04, gain: 0.4, bus: 'sfx', filterType: 'highpass', freq: 4000 });
    // 清回声节点
    window.setTimeout(() => {
      delay.disconnect();
      feedback.disconnect();
      echoOut.disconnect();
    }, 1200);
  }

  /* ---------------- 战斗反馈 ---------------- */

  /** 命中：三角波 1200Hz 50ms */
  playHit(): void {
    if (!this.ready()) return;
    this.tone({ type: 'triangle', freq: 1200, dur: 0.05, gain: 0.25, bus: 'sfx' });
  }

  /** 击杀：琶音 C5-E5-G5 方波，音符间隔 60ms */
  playKill(): void {
    if (!this.ready()) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      this.tone({ type: 'square', freq: f, dur: 0.14, gain: 0.32, bus: 'sfx', delay: i * 0.06 });
    });
  }

  /** 自己死亡：锯齿 400→90Hz 下滑，低通渐闭，600ms */
  playDeath(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const bus = this.buses!.sfx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t0);
    filter.frequency.exponentialRampToValueAtTime(300, t0 + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    osc.connect(filter);
    filter.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + 0.65);
  }

  /** 换弹：两段"咔哒" 2kHz 方波 20ms ×2（间隔 120ms） */
  playReload(): void {
    if (!this.ready()) return;
    this.click(2000, 20, 0.3, 'sfx');
    this.click(2000, 20, 0.3, 'sfx', 0.12);
  }

  /** 空膛：单声 2.5kHz 干咔 40ms */
  playEmpty(): void {
    if (!this.ready()) return;
    this.click(2500, 40, 0.25, 'sfx');
  }

  /* ---------------- 拾取 ---------------- */

  /** 通用拾取：正弦 660→990Hz 上滑 + 泛音，150ms */
  playPickup(item?: ItemType): void {
    if (item === 'shield') {
      this.playPickupShield();
      return;
    }
    if (!this.ready()) return;
    this.tone({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.15, gain: 0.4, bus: 'sfx' });
    this.tone({ type: 'sine', freq: 1320, freqEnd: 1980, dur: 0.15, gain: 0.15, bus: 'sfx' });
    if (item === 'weaponbox') {
      // 武器箱追加一声短亮音
      this.click(1568, 30, 0.2, 'sfx', 0.12);
    }
  }

  playPickupMedkit(): void {
    this.playPickup('medkit');
  }

  playPickupWeaponbox(): void {
    this.playPickup('weaponbox');
  }

  /** 护盾：双音 440+660Hz 正弦叠加，180ms */
  playPickupShield(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sine', freq: 440, dur: 0.18, gain: 0.3, bus: 'sfx' });
    this.tone({ type: 'sine', freq: 660, dur: 0.18, gain: 0.3, bus: 'sfx' });
  }

  /* ---------------- 比赛流程 ---------------- */

  /** 倒计时哔：880Hz 正弦 100ms */
  playCountdownBeep(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sine', freq: 880, dur: 0.1, gain: 0.5, bus: 'ui' });
  }

  /** GO!：1320Hz 明亮长音 250ms */
  playCountdownGo(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sine', freq: 1320, dur: 0.25, gain: 0.55, bus: 'ui' });
    this.tone({ type: 'sine', freq: 2640, dur: 0.25, gain: 0.2, bus: 'ui' });
  }

  /** 最后 10s 警报：660Hz 双短音（每秒调用一次） */
  playLowTimeWarning(): void {
    if (!this.ready()) return;
    this.tone({ type: 'square', freq: 660, dur: 0.06, gain: 0.28, bus: 'ui' });
    this.tone({ type: 'square', freq: 660, dur: 0.06, gain: 0.28, bus: 'ui', delay: 0.12 });
  }

  /** 首杀小号：低鼓 + 上行两音 */
  playFirstBlood(): void {
    if (!this.ready()) return;
    this.tone({ type: 'sine', freq: 150, freqEnd: 70, dur: 0.18, gain: 0.6, bus: 'jingle' });
    this.tone({ type: 'square', freq: 392, dur: 0.12, gain: 0.35, bus: 'jingle', delay: 0.08 });
    this.tone({ type: 'square', freq: 523.25, dur: 0.2, gain: 0.35, bus: 'jingle', delay: 0.18 });
  }

  /** 连杀播报 jingle：上行方波琶音，连杀越高音符越多 */
  playKillstreak(streak: number): void {
    if (!this.ready()) return;
    const base = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const count = streak >= 8 ? 5 : streak >= 5 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      this.tone({
        type: 'square',
        freq: base[i],
        dur: 0.16,
        gain: 0.32,
        bus: 'jingle',
        delay: i * 0.055,
      });
    }
    this.noise({
      dur: 0.3,
      gain: 0.1,
      bus: 'jingle',
      filterType: 'highpass',
      freq: 5000,
      delay: count * 0.055,
    });
  }

  /** 胜利号角：C-E-G-C 上行 + 噪声彩带，1.2s */
  playVictory(): void {
    if (!this.ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone({ type: 'square', freq: f, dur: 0.28, gain: 0.4, bus: 'jingle', delay: i * 0.15 });
      this.tone({ type: 'triangle', freq: f * 2, dur: 0.28, gain: 0.12, bus: 'jingle', delay: i * 0.15 });
    });
    this.noise({
      dur: 0.5,
      gain: 0.12,
      bus: 'jingle',
      filterType: 'highpass',
      freq: 4000,
      delay: 0.6,
    });
    this.tone({ type: 'square', freq: 1046.5, dur: 0.5, gain: 0.35, bus: 'jingle', delay: 0.62 });
  }

  /** 失败：下行四音 */
  playDefeat(): void {
    if (!this.ready()) return;
    const notes = [392, 329.63, 261.63, 220];
    notes.forEach((f, i) => {
      this.tone({ type: 'triangle', freq: f, dur: 0.24, gain: 0.35, bus: 'jingle', delay: i * 0.17 });
    });
  }

  /* ---------------- 心跳（HP<30 循环） ---------------- */

  /** 正弦 60Hz 双跳 / 1.1s 循环 */
  startHeartbeat(): void {
    if (!this.ready() || this.heartbeatId !== null) return;
    const thump = () => {
      if (!this.enabled) return;
      this.tone({ type: 'sine', freq: 60, dur: 0.1, gain: 0.5, bus: 'sfx' });
      this.tone({ type: 'sine', freq: 55, dur: 0.12, gain: 0.4, bus: 'sfx', delay: 0.18 });
    };
    thump();
    this.heartbeatId = setInterval(thump, 1100);
  }

  stopHeartbeat(): void {
    if (this.heartbeatId !== null) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
  }
}

/** 全局单例 */
export const audio = new AudioEngine();
