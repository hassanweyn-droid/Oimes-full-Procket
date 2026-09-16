// ─────────────────────────────────────────────────────────────────────────────
// OIMES — BalanceCard
// Total balance summary with per-wallet breakdown.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Wallet as WalletIcon } from 'lucide-react';
import { useOIMESStore, selectWallets, PLATFORM_METADATA } from '../../store/index';
import { formatUSD } from '../../lib/utils';
import { CARD_VARIANTS } from './DashboardView';
import { PlatformDot } from '../../components/PlatformLogo';

export function BalanceCard() {
  const wallets = useOIMESStore(selectWallets);
  const total = useMemo(
    () => wallets.reduce((s, w) => s + w.balance.amount, 0),
    [wallets]
  );

  return (
    <motion.div
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="visible"
      custom={0}
      className="rounded-2xl border border-border bg-card p-6 flex flex-col"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <WalletIcon className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <span
            className="text-muted-foreground"
            style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            Total Balance
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-accent text-muted-foreground" style={{ fontSize: '11px' }}>
          {wallets.length} wallets
        </span>
      </div>

      <div className="mb-6">
        <div
          className="tabular-nums text-foreground"
          style={{ fontSize: '38px', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05 }}
        >
          {formatUSD(total)}
        </div>
        <p className="mt-1.5 text-muted-foreground" style={{ fontSize: '12px' }}>
          Combined across all platforms · USD
        </p>
      </div>

      <div className="border-t border-border pt-4 space-y-0.5">
        {wallets.map((w) => {
          const meta = PLATFORM_METADATA[w.platform];
          const pct = total > 0 ? (w.balance.amount / total) * 100 : 0;
          return (
            <div
              key={w.id}
              className="flex items-center gap-3 py-2 rounded-lg hover:bg-accent/40 px-2 -mx-2 transition-colors"
            >
              <PlatformDot platform={w.platform} size={18} />
              <span className="flex-1 text-muted-foreground" style={{ fontSize: '13px' }}>
                {meta.displayName}
              </span>
              <div className="hidden sm:block w-14 h-1 rounded-full bg-accent overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: meta.brandColor, opacity: 0.65 }}
                />
              </div>
              <span className="tabular-nums text-foreground" style={{ fontSize: '13px', fontWeight: 500 }}>
                {formatUSD(w.balance.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
