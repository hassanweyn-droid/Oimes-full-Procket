// ─────────────────────────────────────────────────────────────────────────────
// OIMES — CostBreakdown
// Receipt-style exchange preview showing fee breakdown and net received amount.
// ─────────────────────────────────────────────────────────────────────────────

import { ArrowLeftRight } from 'lucide-react';
import { PLATFORM_METADATA } from '../../store/index';
import { formatUSD, round2 } from '../../lib/utils';
import { PlatformDot } from '../../components/PlatformLogo';
import type { MobileMoneyPlatform } from '../../types';

interface CostBreakdownProps {
  fromPlatform: MobileMoneyPlatform;
  toPlatform: MobileMoneyPlatform;
  amount: number;
  spread: number;
  rate: number;
}

interface RowProps {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  bold?: boolean;
}

function Row({ label, value, sub, valueColor, bold }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground" style={{ fontSize: '12px' }}>
        {label}
        {sub && <span style={{ fontSize: '10px', marginLeft: '4px' }}>({sub})</span>}
      </span>
      <span
        className="tabular-nums shrink-0"
        style={{ fontSize: '13px', fontWeight: bold ? 600 : 400, color: valueColor ?? 'var(--foreground)' }}
      >
        {value}
      </span>
    </div>
  );
}

export function CostBreakdown({ fromPlatform, toPlatform, amount, spread, rate }: CostBreakdownProps) {
  const gatewayFee = round2(amount * spread);
  const received   = round2((amount - gatewayFee) * rate);
  const fromMeta   = PLATFORM_METADATA[fromPlatform];
  const toMeta     = PLATFORM_METADATA[toPlatform];

  return (
    <div className="rounded-xl border border-border bg-accent/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-accent/30">
        <PlatformDot platform={fromPlatform} size={15} />
        <span style={{ fontSize: '11px' }}>{fromMeta.shortCode}</span>
        <ArrowLeftRight className="size-3 text-muted-foreground" />
        <PlatformDot platform={toPlatform} size={15} />
        <span style={{ fontSize: '11px' }}>{toMeta.shortCode}</span>
        <span className="ml-auto text-muted-foreground" style={{ fontSize: '10px' }}>Exchange preview</span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <Row label="You send"      value={formatUSD(amount)} />
        <Row label="Exchange rate" value={`1 ${fromMeta.shortCode} = ${rate.toFixed(4)} ${toMeta.shortCode}`} />
        <Row label="Gateway fee"   sub={`${(spread * 100).toFixed(1)}%`} value={`− ${formatUSD(gatewayFee)}`} valueColor="#DC2626" />
        <Row label="Service fee"   value="$0.00" valueColor="var(--muted-foreground)" />
      </div>

      <div className="flex items-baseline justify-between px-4 py-3 border-t border-border bg-background/50">
        <span style={{ fontSize: '12px', fontWeight: 500 }}>You receive</span>
        <span className="tabular-nums" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--status-success-fg)' }}>
          {formatUSD(received)}
        </span>
      </div>
    </div>
  );
}
