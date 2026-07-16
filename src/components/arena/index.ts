/**
 * 共享竞技场 UI 组件（design.md §10）统一出口。
 */

export { default as ArenaButton } from './ArenaButton';
export type { ArenaButtonProps, ArenaButtonVariant, ArenaButtonSize } from './ArenaButton';

export { default as ArenaPanel } from './ArenaPanel';
export type { ArenaPanelProps } from './ArenaPanel';

export { default as StatBar } from './StatBar';
export type { StatBarProps } from './StatBar';

export { default as PlayerBadge } from './PlayerBadge';
export type { PlayerBadgeProps, BadgeFace } from './PlayerBadge';

export { default as Chip } from './Chip';
export type { ChipProps } from './Chip';

export { default as Toggle } from './Toggle';
export type { ToggleProps } from './Toggle';

export { default as KillFeedItem } from './KillFeedItem';
export type { KillFeedItemProps } from './KillFeedItem';

export { default as CountdownOverlay } from './CountdownOverlay';
export type { CountdownOverlayProps } from './CountdownOverlay';

export { default as AnnouncementBanner } from './AnnouncementBanner';
export type { AnnouncementBannerProps, AnnouncementTone } from './AnnouncementBanner';

export { default as KeyCap } from './KeyCap';
export type { KeyCapProps } from './KeyCap';
