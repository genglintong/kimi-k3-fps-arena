/**
 * 全局设置与对战配置的本地持久化（localStorage）。
 * home 设置抽屉 / 游戏暂停层 / 游戏开局读取共用，键名见 constants.STORAGE_KEYS。
 */

import {
  DEFAULT_BOT_COUNT,
  DEFAULT_DIFFICULTY,
  STORAGE_KEYS,
} from './constants';
import type { BotCount, Difficulty } from './constants';

/* ------------------------------------------------------------------ */
/* 全局设置                                                            */
/* ------------------------------------------------------------------ */

export interface ArenaSettings {
  /** 音效开关 */
  sound: boolean;
  /** 音量 0–100 */
  volume: number;
  /** 屏幕震动 */
  shake: boolean;
  /** 伤害数字飘字 */
  damageNumbers: boolean;
  /** 击杀播报 */
  killFeed: boolean;
}

export const DEFAULT_SETTINGS: ArenaSettings = {
  sound: true,
  volume: 80,
  shake: true,
  damageNumbers: true,
  killFeed: true,
};

export function loadSettings(): ArenaSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ArenaSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: ArenaSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    /* 隐私模式等场景静默失败 */
  }
}

/** 设置变更时派发的 window 事件名（Navbar / 抽屉 / 暂停层跨组件同步用） */
export const SETTINGS_EVENT = 'gun-arena:settings-changed';

/** 保存并广播设置变更 */
export function updateSettings(settings: ArenaSettings): void {
  saveSettings(settings);
  window.dispatchEvent(new CustomEvent<ArenaSettings>(SETTINGS_EVENT, { detail: settings }));
}

/* ------------------------------------------------------------------ */
/* 对战配置（home 写入，game 开局读取）                                  */
/* ------------------------------------------------------------------ */

export interface MatchConfig {
  botCount: BotCount;
  difficulty: Difficulty;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  botCount: DEFAULT_BOT_COUNT,
  difficulty: DEFAULT_DIFFICULTY,
};

const VALID_BOT_COUNTS: BotCount[] = [3, 5, 7];
const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export function loadMatchConfig(): MatchConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.matchConfig);
    if (!raw) return { ...DEFAULT_MATCH_CONFIG };
    const parsed = JSON.parse(raw) as Partial<MatchConfig>;
    return {
      botCount: VALID_BOT_COUNTS.includes(parsed.botCount as BotCount)
        ? (parsed.botCount as BotCount)
        : DEFAULT_MATCH_CONFIG.botCount,
      difficulty: VALID_DIFFICULTIES.includes(parsed.difficulty as Difficulty)
        ? (parsed.difficulty as Difficulty)
        : DEFAULT_MATCH_CONFIG.difficulty,
    };
  } catch {
    return { ...DEFAULT_MATCH_CONFIG };
  }
}

export function saveMatchConfig(config: MatchConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.matchConfig, JSON.stringify(config));
  } catch {
    /* 静默失败 */
  }
}
