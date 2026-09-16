// ─────────────────────────────────────────────────────────────────────────────
// OIMES — OtpInput
// 6-digit OTP input with keyboard navigation and paste support.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from 'react';

interface OtpInputProps {
  value: string[];
  onChange: (digits: string[]) => void;
  hasError: boolean;
}

export function OtpInput({ value, onChange, hasError }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft'  && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = Array(6).fill('').map((_, i) => pasted[i] ?? '');
    onChange(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex items-center gap-2 justify-center">
      {Array(6).fill(null).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={[
            'flex items-center justify-center rounded-lg border bg-background',
            'text-center tabular-nums transition-all',
            'focus:outline-none focus:ring-2',
            hasError
              ? 'border-destructive focus:ring-destructive/20'
              : 'border-border focus:border-foreground/40 focus:ring-foreground/10',
            value[i] ? 'border-foreground/30' : '',
          ].join(' ')}
          style={{ width: '44px', height: '52px', fontSize: '20px', fontWeight: 600 }}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
