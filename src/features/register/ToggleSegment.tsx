import type { ReactNode } from 'react';

type ToggleValue = string;

interface ToggleOption<T extends ToggleValue> {
  label: ReactNode;
  value: T;
}

interface ToggleSegmentProps<T extends ToggleValue> {
  value: T;
  options: ToggleOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function ToggleSegment<T extends ToggleValue>({ value, options, onChange, className }: ToggleSegmentProps<T>) {
  const rootClassName = ['inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium text-slate-600', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName} role="group" aria-label="Toggle selection mode">
      {options.map((option) => {
        const active = option.value === value;
        const buttonClass = [
          'rounded-full px-3 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
        ].join(' ');

        return (
          <button
            key={option.value}
            type="button"
            className={buttonClass}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
