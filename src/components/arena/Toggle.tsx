/**
 * Toggle —— 设置开关（design.md §10.6）
 * 轨道 56×32 圆角 999px；knob 24px 白圆带 2px ink 描边；
 * ON = grn 底 + knob 右移（200ms ease-bounce），OFF = bg-panel-2。
 */

import { cn } from '@/lib/utils';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export default function Toggle({ checked, onChange, disabled, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors duration-200 ease-bounce disabled:opacity-50',
        checked ? 'bg-grn' : 'bg-bg-panel-2 border border-line-soft',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'block h-6 w-6 rounded-full border-2 border-ink bg-white shadow-[0_2px_0_#14122E] transition-transform duration-200 ease-bounce',
          checked ? 'translate-x-6' : 'translate-x-0',
        )}
      />
    </button>
  );
}
