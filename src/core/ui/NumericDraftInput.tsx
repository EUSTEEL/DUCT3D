import { useState } from 'react';

interface NumericDraftInputProps {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  ariaLabel?: string;
  title?: string;
  className?: string;
  onCommit: (next: number) => void;
}

/**
 * Reusable keyboard-friendly integer input:
 * Uses nullable string draft (`null` when idle) so users can select, delete all digits,
 * and type numbers freely without mid-keystroke clamping; commits normalized [min, max]
 * on Enter or onBlur, and supports Escape / ArrowUp / ArrowDown.
 */
export function NumericDraftInput({
  id,
  value,
  min,
  max,
  step = 1,
  ariaLabel,
  title,
  className = '',
  onCommit,
}: NumericDraftInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));

  const commitDraft = (raw: string | null) => {
    setDraft(null);
    if (raw === null) return;
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return;
    const next = clamp(parsed);
    if (next !== value) {
      onCommit(next);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      title={title}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value.replace(/[^\d]/g, ''));
      }}
      onBlur={() => commitDraft(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commitDraft(draft);
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const next = clamp(value + step);
          setDraft(String(next));
          onCommit(next);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = clamp(value - step);
          setDraft(String(next));
          onCommit(next);
        }
      }}
      className={className}
    />
  );
}
