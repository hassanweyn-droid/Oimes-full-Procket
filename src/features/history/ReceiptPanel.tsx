// ─────────────────────────────────────────────────────────────────────────────
// OIMES — ReceiptPanel
// Printable transaction receipt with full financial and compliance details.
// ─────────────────────────────────────────────────────────────────────────────

import { format, addDays } from 'date-fns';
import { Printer } from 'lucide-react';
import { PLATFORM_METADATA } from '../../store/index';
import { formatUSD } from '../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { PlatformDot } from '../../components/PlatformLogo';
import type { Transaction } from '../../types';

// ─── Business-day clearing date (T+1) ────────────────────────────────────────

function calcClearingDate(initiatedAt: string): Date {
  let d = addDays(new Date(initiatedAt), 1);
  if (d.getDay() === 6) d = addDays(d, 2); // Sat → Mon
  if (d.getDay() === 0) d = addDays(d, 1); // Sun → Mon
  return d;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
  bold?: boolean;
}

function Row({ label, value, mono, color, bold }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-muted-foreground shrink-0" style={{ fontSize: '11px' }}>{label}</span>
      <span
        className="text-right min-w-0 break-all"
        style={{
          fontSize: mono ? '11px' : '12px',
          fontWeight: bold ? 600 : 400,
          color: color ?? 'var(--foreground)',
          fontFamily: mono ? 'ui-monospace, "SF Mono", monospace' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border border-dashed" />;
}

// ─── ReceiptPanel ─────────────────────────────────────────────────────────────

interface ReceiptPanelProps {
  tx: Transaction;
}

export function ReceiptPanel({ tx }: ReceiptPanelProps) {
  const fromMeta   = PLATFORM_METADATA[tx.fromWallet.platform];
  const toMeta     = PLATFORM_METADATA[tx.toWallet.platform];
  const clearDate  = calcClearingDate(tx.initiatedAt);
  const gatewayFee = tx.fee.gatewayFee.amount;
  const serviceFee = tx.fee.serviceFee.amount;
  const spread     = tx.exchangeRate ? (tx.exchangeRate.spread * 100).toFixed(2) : '—';

  const fmtDateTime = (iso: string) => format(new Date(iso), 'dd MMM yyyy, HH:mm');

  return (
    <div className="px-5 py-5 bg-background border-t border-border">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center size-6 rounded bg-primary">
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'white' }}>OI</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>OIMES</span>
            </div>
            <p className="text-muted-foreground" style={{ fontSize: '10px' }}>
              OIMES Financial Services · Mogadishu, Somalia
            </p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Payment Receipt
            </p>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace' }}>
              #{tx.reference}
            </p>
          </div>
        </div>

        <Divider />

        <div className="grid grid-cols-2 gap-5 py-4">
          {[{ label: 'Sender', meta: fromMeta, platform: tx.fromWallet.platform, phone: tx.fromWallet.phoneNumber }, { label: 'Recipient', meta: toMeta, platform: tx.toWallet.platform, phone: tx.toWallet.phoneNumber }].map(({ label, meta, platform, phone }) => (
            <div key={label}>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
                {label}
              </p>
              <div className="flex items-center gap-2 mb-1">
                <PlatformDot platform={platform} size={18} />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{meta.displayName}</span>
              </div>
              <p style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace' }} className="text-muted-foreground">{phone}</p>
              <p className="text-muted-foreground" style={{ fontSize: '10px', marginTop: '2px' }}>{meta.operator}</p>
            </div>
          ))}
        </div>

        <Divider />

        <div className="py-4 space-y-0.5">
          <Row label="Amount Sent"    value={formatUSD(tx.fromAmount.amount)} bold />
          <Row label="Exchange Rate"  value={tx.exchangeRate ? `1 ${fromMeta.shortCode} = ${tx.exchangeRate.rate.toFixed(4)} ${toMeta.shortCode}` : '1:1'} />
          <Row label={`Gateway Fee (${spread}%)`} value={`− ${formatUSD(gatewayFee)}`} color="#DC2626" />
          <Row label="Service Fee"    value={`− ${formatUSD(serviceFee)}`} color="var(--muted-foreground)" />
        </div>

        <Divider />

        <div className="flex items-baseline justify-between py-4">
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Amount Received</span>
          <span className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-success-fg)' }}>
            {formatUSD(tx.toAmount.amount)}
          </span>
        </div>

        <Divider />

        <div className="grid grid-cols-2 gap-5 py-4">
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Initiated</p>
            <p style={{ fontSize: '12px' }}>{fmtDateTime(tx.initiatedAt)}</p>
          </div>
          {tx.completedAt && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Completed</p>
              <p style={{ fontSize: '12px' }}>{fmtDateTime(tx.completedAt)}</p>
            </div>
          )}
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Clearing Date (T+1)</p>
            <p style={{ fontSize: '12px' }}>
              {format(clearDate, 'dd MMM yyyy')}
              <span className="text-muted-foreground" style={{ fontSize: '10px', marginLeft: '6px' }}>Business day</span>
            </p>
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Settlement Status</p>
            <StatusBadge status={tx.status} />
          </div>
        </div>

        {tx.status === 'failed' && tx.failureReason && (
          <>
            <Divider />
            <div className="py-4">
              <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                Reason
              </p>
              <p style={{ fontSize: '12px', color: 'var(--destructive)' }}>{tx.failureReason}</p>
            </div>
          </>
        )}

        <Divider />

        <div className="py-4 space-y-0.5">
          <Row label="Transaction ID"     value={tx.id}        mono />
          <Row label="Internal Reference" value={tx.reference} mono />
          {tx.externalReference && (
            <Row label="Platform Reference" value={tx.externalReference} mono />
          )}
          <Row label="Transaction Type" value={tx.type.toUpperCase()} />
        </div>

        <div className="pt-1 pb-2">
          <p className="text-muted-foreground" style={{ fontSize: '10px', lineHeight: 1.6 }}>
            This receipt is auto-generated by OIMES Financial Services. For disputes or settlement
            queries, quote the Internal Reference above. Exchange operations subject to Somali
            Financial Regulatory Authority (SFRA) guidelines.
          </p>
        </div>

        <div className="pt-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            style={{ fontSize: '12px' }}
          >
            <Printer className="size-3.5" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
