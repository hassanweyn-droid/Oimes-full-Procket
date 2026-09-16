// ─────────────────────────────────────────────────────────────────────────────
// OIMES — WalletDropdown
// Custom accessible dropdown for selecting a wallet, with click-outside dismiss.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { WalletOption } from './WalletOption';
import type { Wallet } from '../../types';

interface WalletDropdownProps {
  label: string;
  selectedId: string;
  wallets: Wallet[];
  excludeId?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function WalletDropdown({
  label,
  selectedId,
  wallets,
  excludeId,
  onChange,
  disabled,
}: WalletDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = wallets.find((w) => w.id === selectedId);
  const options  = wallets.filter((w) => w.id !== excludeId);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <p
        className="mb-1.5 text-muted-foreground"
        style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}
      >
        {label}
      </p>
      <button
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className={[
          'w-full flex items-center justify-between gap-2 px-4 py-3',
          'rounded-xl border border-border bg-background',
          'hover:border-foreground/30 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isOpen ? 'border-foreground/40 ring-2 ring-foreground/10' : '',
        ].join(' ')}
      >
        {selected ? (
          <WalletOption wallet={selected} compact />
        ) : (
          <span className="text-muted-foreground" style={{ fontSize: '13px' }}>Select wallet…</span>
        )}
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl border border-border bg-background shadow-lg overflow-hidden"
          >
            {options.map((w) => (
              <button
                key={w.id}
                onClick={() => { onChange(w.id); setIsOpen(false); }}
                className={[
                  'w-full flex items-center px-4 py-3',
                  'hover:bg-accent transition-colors border-b border-border last:border-b-0',
                  selectedId === w.id ? 'bg-accent/50' : '',
                ].join(' ')}
              >
                <WalletOption wallet={w} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
