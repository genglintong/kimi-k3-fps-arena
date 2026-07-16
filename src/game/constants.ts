/**
 * 枪火竞技场 · 游戏核心常量（design.md §11 / game.md §6.1 §7 §8.2）
 * 跨页面唯一事实源：数值只允许在此修改，禁止各页面另立。
 * 本文件只包含数据与类型，不包含游戏逻辑。
 */

/* ------------------------------------------------------------------ */
/* 基础类型                                                            */
/* ------------------------------------------------------------------ */

export type WeaponId = 'pistol' | 'shotgun' | 'rifle' | 'sniper';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type BotCount = 3 | 5 | 7;
export type ItemType = 'medkit' | 'weaponbox' | 'shield';
export type BotPersonality = 'berserker' | 'gunner' | 'roamer' | 'sniper' | 'camper';

/* ------------------------------------------------------------------ */
/* 比赛规则（design.md §11）                                           */
/* ------------------------------------------------------------------ */

/** 比赛时长（秒）；最后 LOW_TIME_WARNING_S 秒进入警报态 */
export const MATCH_DURATION_S = 180;
export const LOW_TIME_WARNING_S = 10;
/** 击杀数并列第一时的加时（突然死亡）时长 */
export const OVERTIME_S = 30;
/** 击杀得分：击杀 +1，积分榜按击杀排序 */
export const SCORE_PER_KILL = 1;
/** 死亡重生等待（秒） */
export const RESPAWN_DELAY_S = 3.0;
/** 重生无敌泡泡时长（秒） */
export const RESPAWN_INVINCIBLE_S = 2;
/** 随机出生点距最近敌人的最小距离（世界单位） */
export const SPAWN_MIN_ENEMY_DIST = 500;
/** 倒计时总时长（秒） */
export const COUNTDOWN_S = 3.2;

/** 胜利判定优先级：击杀多 → 死亡少 → 总伤害高 */
export const WIN_TIEBREAKERS = ['kills', 'deaths', 'damage'] as const;

/* ------------------------------------------------------------------ */
/* 角色数值                                                            */
/* ------------------------------------------------------------------ */

export const PLAYER_HP = 100;
export const SHIELD_MAX = 100;
/** 玩家移动速度（世界单位/秒） */
export const PLAYER_SPEED = 240;
/** 玩家固定色（蓝） */
export const PLAYER_COLOR = '#3EA6FF';
export const PLAYER_NAME = '你';

/* ------------------------------------------------------------------ */
/* 世界尺寸                                                            */
/* ------------------------------------------------------------------ */

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;

/* ------------------------------------------------------------------ */
/* 武器（game.md §6.1 数值表，唯一事实源）                              */
/* ------------------------------------------------------------------ */

export interface WeaponDef {
  id: WeaponId;
  /** 中文名 */
  name: string;
  /** 英文展示名 */
  nameEn: string;
  /** 单发伤害（霰弹为单颗弹丸伤害） */
  damage: number;
  /** 单发弹丸数（霰弹 6，其余 1） */
  pellets: number;
  /** 射击间隔（毫秒） */
  fireIntervalMs: number;
  /** 是否全自动 */
  auto: boolean;
  /** 弹匣容量 */
  magazine: number;
  /** 换弹时长（毫秒） */
  reloadMs: number;
  /** 射程（世界单位） */
  range: number;
  /** 弹速（世界单位/秒） */
  bulletSpeed: number;
  /** 基础散布（±度） */
  spreadDeg: number;
  /** 备弹量；手枪无限 */
  ammoReserve: number;
  /** 超出射程伤害衰减系数（仅霰弹） */
  falloff?: number;
  /** 穿透目标数（仅狙击；第二个目标伤害 ×0.6） */
  pierce?: number;
  /** 连射散布增长（仅步枪：+0.4°/发，上限 maxSpreadDeg，停射 recoverMs 后回落） */
  spreadRamp?: { perShotDeg: number; maxSpreadDeg: number; recoverMs: number };
  /** 语义色 */
  color: string;
  colorDark: string;
  /** 一句话定位 */
  tagline: string;
  /** 插画资产路径 */
  image: string;
  /** 5 点制能力点（武器速览卡 / 武器库共用） */
  statDots: { damage: number; fireRate: number; range: number };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: '手枪',
    nameEn: 'PISTOL',
    damage: 12,
    pellets: 1,
    fireIntervalMs: 300,
    auto: false,
    magazine: 12,
    reloadMs: 1100,
    range: 520,
    bulletSpeed: 750,
    spreadDeg: 2.5,
    ammoReserve: Infinity,
    color: '#3EA6FF',
    colorDark: '#1B6FD1',
    tagline: '万金油，永远可靠',
    image: '/weapon-pistol.svg',
    statDots: { damage: 2, fireRate: 3, range: 3 },
  },
  shotgun: {
    id: 'shotgun',
    name: '霰弹枪',
    nameEn: 'SHOTGUN',
    damage: 7,
    pellets: 6,
    fireIntervalMs: 850,
    auto: false,
    magazine: 6,
    reloadMs: 1800,
    range: 330,
    bulletSpeed: 620,
    spreadDeg: 24,
    ammoReserve: 24,
    falloff: 0.4,
    color: '#FF8A3D',
    colorDark: '#D9622B',
    tagline: '贴脸一发入魂',
    image: '/weapon-shotgun.svg',
    statDots: { damage: 5, fireRate: 1, range: 1 },
  },
  rifle: {
    id: 'rifle',
    name: '步枪',
    nameEn: 'RIFLE',
    damage: 9,
    pellets: 1,
    fireIntervalMs: 115,
    auto: true,
    magazine: 30,
    reloadMs: 1500,
    range: 660,
    bulletSpeed: 950,
    spreadDeg: 5,
    ammoReserve: 90,
    spreadRamp: { perShotDeg: 0.4, maxSpreadDeg: 9, recoverMs: 400 },
    color: '#3ED97E',
    colorDark: '#1FA85A',
    tagline: '持续火力压制',
    image: '/weapon-rifle.svg',
    statDots: { damage: 3, fireRate: 5, range: 4 },
  },
  sniper: {
    id: 'sniper',
    name: '狙击枪',
    nameEn: 'SNIPER',
    damage: 75,
    pellets: 1,
    fireIntervalMs: 1300,
    auto: false,
    magazine: 4,
    reloadMs: 2400,
    range: 1050,
    bulletSpeed: 1500,
    spreadDeg: 0.4,
    ammoReserve: 12,
    pierce: 1,
    color: '#9B5CFF',
    colorDark: '#6E35CC',
    tagline: '千里之外取人首级',
    image: '/weapon-sniper.svg',
    statDots: { damage: 5, fireRate: 1, range: 5 },
  },
};

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'shotgun', 'rifle', 'sniper'];

/** 切枪时长（毫秒），切枪期间不可射击 */
export const WEAPON_SWITCH_MS = 250;
/** 武器箱开出概率：步枪 40% / 霰弹 35% / 狙击 25% */
export const WEAPONBOX_WEIGHTS: { weapon: WeaponId; weight: number }[] = [
  { weapon: 'rifle', weight: 0.4 },
  { weapon: 'shotgun', weight: 0.35 },
  { weapon: 'sniper', weight: 0.25 },
];

/* ------------------------------------------------------------------ */
/* 道具（game.md §7）                                                  */
/* ------------------------------------------------------------------ */

export interface ItemDef {
  type: ItemType;
  name: string;
  /** 效果值：回血 +40HP / 护盾 +50（武器箱为 0） */
  value: number;
  /** 被拾取后刷新间隔（秒） */
  respawnS: number;
  color: string;
  image: string;
}

export const ITEMS: Record<ItemType, ItemDef> = {
  medkit: {
    type: 'medkit',
    name: '回血包',
    value: 40,
    respawnS: 15,
    color: '#3ED97E',
    image: '/item-medkit.svg',
  },
  weaponbox: {
    type: 'weaponbox',
    name: '武器箱',
    value: 0,
    respawnS: 18,
    color: '#9B5CFF',
    image: '/item-weaponbox.svg',
  },
  shield: {
    type: 'shield',
    name: '护盾',
    value: 50,
    respawnS: 20,
    color: '#3EA6FF',
    image: '/item-shield.svg',
  },
};

/* ------------------------------------------------------------------ */
/* 机器人名册（design.md §11；guide.md 与积分榜共用）                    */
/* ------------------------------------------------------------------ */

export interface BotDef {
  id: string;
  name: string;
  color: string;
  colorDark: string;
  personality: BotPersonality;
  /** 性格标签（展示用） */
  trait: string;
  /** 性格描述（guide.md 档案用） */
  bio: string;
}

export const BOT_ROSTER: BotDef[] = [
  {
    id: 'tiepidan',
    name: '铁皮蛋',
    color: '#FF5A5F',
    colorDark: '#D63A44',
    personality: 'berserker',
    trait: '莽夫',
    bio: '见人就冲，贴脸输出。撤退？字典里没有这两个字。',
  },
  {
    id: 'baozaogu',
    name: '暴躁菇',
    color: '#FF8A3D',
    colorDark: '#D9622B',
    personality: 'gunner',
    trait: '火力狂',
    bio: '爱抢武器箱，弹雨压制。子弹多就是道理大。',
  },
  {
    id: 'paopaojiang',
    name: '跑跑姜',
    color: '#3ED97E',
    colorDark: '#1FA85A',
    personality: 'roamer',
    trait: '游击手',
    bio: '边打边跑，专捡道具。你追不上我～',
  },
  {
    id: 'shenqiang',
    name: '神枪阿亮',
    color: '#9B5CFF',
    colorDark: '#6E35CC',
    personality: 'sniper',
    trait: '老六',
    bio: '远距离架枪，冷静点射。看不见的子弹最致命。',
  },
  {
    id: 'laoliu',
    name: '老六',
    color: '#FF6FB5',
    colorDark: '#D14E8F',
    personality: 'camper',
    trait: '伏地魔',
    bio: '蹲掩体后等你路过。惊喜总在拐角处。',
  },
];

/** 7 机器人模式下补充的扩展名册（5 人名册用尽后按序取用） */
export const BOT_EXTRA_POOL: BotDef[] = [
  {
    id: 'gangbeng',
    name: '钢镚',
    color: '#B8E62E',
    colorDark: '#7FA819',
    personality: 'gunner',
    trait: '愣头青',
    bio: '横冲直撞的愣头青，枪口永远朝着人堆。',
  },
  {
    id: 'tiaotiaotang',
    name: '跳跳糖',
    color: '#4FD9E8',
    colorDark: '#2AA8B8',
    personality: 'roamer',
    trait: '小灵精',
    bio: '满场蹦跶的小灵精，道具一个都不放过。',
  },
];

export const BOT_COUNT_OPTIONS: BotCount[] = [3, 5, 7];
export const DEFAULT_BOT_COUNT: BotCount = 5;

/* ------------------------------------------------------------------ */
/* 难度预设（game.md §8.2）                                            */
/* ------------------------------------------------------------------ */

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  /** 选中态语义色 */
  color: string;
  /** 感知半径（世界单位） */
  perception: number;
  /** 反应时间（毫秒） */
  reactionMs: number;
  /** 瞄准误差（±度，目标移动时 +30%） */
  aimErrorDeg: number;
  /** 移动速度（世界单位/秒） */
  speed: number;
  /** 抢道具倾向 0–1 */
  itemGreed: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: 'easy',
    name: '简单',
    color: '#3ED97E',
    perception: 480,
    reactionMs: 450,
    aimErrorDeg: 14,
    speed: 220,
    itemGreed: 0.25,
  },
  normal: {
    id: 'normal',
    name: '普通',
    color: '#FFC831',
    perception: 560,
    reactionMs: 320,
    aimErrorDeg: 9,
    speed: 235,
    itemGreed: 0.5,
  },
  hard: {
    id: 'hard',
    name: '困难',
    color: '#FF5A5F',
    perception: 640,
    reactionMs: 220,
    aimErrorDeg: 5,
    speed: 250,
    itemGreed: 0.9,
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/* ------------------------------------------------------------------ */
/* 连杀与播报（design.md §11 / game.md §9.6）                          */
/* ------------------------------------------------------------------ */

export const FIRST_BLOOD_TEXT = '第一滴血！';

export interface KillstreakDef {
  streak: number;
  text: string;
}

/** 连杀播报阈值（达到对应连杀数时播报） */
export const KILLSTREAKS: KillstreakDef[] = [
  { streak: 3, text: '三连杀！' },
  { streak: 5, text: '五连绝世！' },
  { streak: 8, text: '超神！' },
];

/* ------------------------------------------------------------------ */
/* 颜色语义（design.md §4.3，Canvas 绘制共用）                          */
/* ------------------------------------------------------------------ */

export const COLORS = {
  ink: '#14122E',
  bgDeep: '#15173D',
  bgPanel: '#20234F',
  bgPanel2: '#2B2F6B',
  lineSoft: '#3A3F85',
  txt: '#FFFFFF',
  txtMute: '#A9AEE0',
  txtDim: '#6E74B8',
  yel: '#FFC831',
  yelDark: '#D99400',
  blu: '#3EA6FF',
  bluDark: '#1B6FD1',
  red: '#FF5A5F',
  redDark: '#D63A44',
  grn: '#3ED97E',
  grnDark: '#1FA85A',
  pur: '#9B5CFF',
  purDark: '#6E35CC',
  org: '#FF8A3D',
  orgDark: '#D9622B',
  pink: '#FF6FB5',
  pinkDark: '#D14E8F',
  /** 竞技场地板 */
  floorBase: '#7FD1A8',
  floorA: '#8CDAB2',
  floorB: '#76C89E',
  void: '#0F1030',
} as const;

/* ------------------------------------------------------------------ */
/* 本地存储键（跨页面共享读写约定）                                      */
/* ------------------------------------------------------------------ */

export const STORAGE_KEYS = {
  /** 对战配置 { botCount, difficulty } — home 写入，game 读取 */
  matchConfig: 'gun-arena:match-config',
  /** 全局设置 { sound, volume, shake, damageNumbers, killFeed } */
  settings: 'gun-arena:settings',
} as const;
