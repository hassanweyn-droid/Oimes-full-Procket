// ─────────────────────────────────────────────────────────────────────────────
// OIMES — TxRow
// Expandable transaction row with summary and inline receipt.
// ─────────────────────────────────────────────────────────────────────────────

import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ArrowLeftRight } from 'lucide-react';
import { PLATFORM_METADATA } from '../../store/index';
import { formatUSD } from '../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { ReceiptPanel } from './ReceiptPanel';
import { PlatformDot } from '../../components/PlatformLogo';
import type { Transaction } from '../../types';

interface TxRowProps {
  tx: Transaction;
  expanded: boolean;
  onToggle: () => void;
}

export function TxRow({ tx, expanded, onToggle }: TxRowProps) {
  const fromMeta = PLATFORM_METADATA[tx.fromWallet.platform];
  const toMeta   = PLATFORM_METADATA[tx.toWallet.platform];
  const refShort = tx.reference.split('-').slice(-2).join('-');

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent/20 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="hidden sm:block shrink-0" style={{ width: '100px' }}>
          <p style={{ fontSize: '12px' }}>{format(new Date(tx.initiatedAt), 'dd MMM yyyy')}</p>
          <p className="text-muted-foreground" style={{ fontSize: '10px' }}>
            {format(new Date(tx.initiatedAt), 'HH:mm')}
          </p>
        </div>

        <div className="hidden md:block shrink-0" style={{ width: '130px' }}>
          <p className="text-muted-foreground truncate" style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
            {refShort}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <PlatformDot platform={tx.fromWallet.platform} size={15} />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>{fromMeta.shortCode}</span>
          </div>
          <ArrowLeftRight className="size-3 text-muted-foreground" />
          <div className="flex items-center gap-1">
            <PlatformDot platform={tx.toWallet.platform} size={15} />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>{toMeta.shortCode}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-4">
          <div className="text-right hidden sm:block">
            <p className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500 }}>
              {formatUSD(tx.fromAmount.amount)}
            </p>
            <p className="tabular-nums text-muted-foreground" style={{ fontSize: '10px' }}>
              − {formatUSD(tx.fee.total.amount)} fee
            </p>
          </div>
          <div className="text-right">
            <p className="tabular-nums" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--status-success-fg)' }}>
              {formatUSD(tx.toAmount.amount)}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <StatusBadge status={tx.status} />
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="size-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="receipt"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ReceiptPanel tx={tx} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
