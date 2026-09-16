// ─────────────────────────────────────────────────────────────────────────────
// OIMES — WalletOption
// Shared display atom for a wallet entry (used in dropdowns and selected state).
// ─────────────────────────────────────────────────────────────────────────────

import { PLATFORM_METADATA } from '../../store/index';
import { formatUSD } from '../../lib/utils';
import { PlatformLogo } from '../../components/PlatformLogo';
import type { Wallet } from '../../types';

interface WalletOptionProps {
  wallet: Wallet;
  compact?: boolean;
}

export function WalletOption({ wallet, compact = false }: WalletOptionProps) {
  const meta = PLATFORM_METADATA[wallet.platform];
  return (
    <div className="flex items-center gap-3 min-w-0">
      <PlatformLogo platform={wallet.platform} size={compact ? 28 : 34} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{meta.displayName}</span>
          {wallet.isDefault && (
            <span
              className="px-1.5 py-px rounded bg-primary text-primary-foreground"
              style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.05em' }}
            >
              DEFAULT
            </span>
          )}
        </div>
        <p className="text-muted-foreground truncate" style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
          {wallet.phoneNumber}
        </p>
      </div>
      {!compact && (
        <span className="tabular-nums text-muted-foreground shrink-0" style={{ fontSize: '12px' }}>
          {formatUSD(wallet.balance.amount)}
        </span>
      )}
    </div>
  );
}
