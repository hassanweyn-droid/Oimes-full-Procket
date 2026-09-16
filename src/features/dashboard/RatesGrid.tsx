// ─────────────────────────────────────────────────────────────────────────────
// OIMES — RatesGrid
// Live exchange rate matrix with color-coded gateway fees.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useOIMESStore, selectExchangeRates, PLATFORM_METADATA } from '../../store/index';
import { PLATFORM_ORDER, RATE_COLOR_LEGEND, getSpreadColor } from '../../lib/constants';
import { CARD_VARIANTS } from './DashboardView';
import { PlatformDot } from '../../components/PlatformLogo';
import type { MobileMoneyPlatform } from '../../types';

// ─── PlatformLabel ────────────────────────────────────────────────────────────

function PlatformLabel({ platform }: { platform: MobileMoneyPlatform }) {
  const meta = PLATFORM_METADATA[platform];
  return (
    <div className="flex items-center gap-1.5">
      <PlatformDot platform={platform} size={16} />
      <span style={{ fontSize: '12px', fontWeight: 500 }}>{meta.shortCode}</span>
    </div>
  );
}

// ─── RatesGrid ────────────────────────────────────────────────────────────────

export function RatesGrid() {
  const rates = useOIMESStore(selectExchangeRates);

  const lookup = useMemo(() => {
    const m = new Map<string, number>();
    rates.forEach((r) => m.set(`${r.fromPlatform}_${r.toPlatform}`, r.spread));
    return m;
  }, [rates]);

  const updatedAgo = rates[0]?.fetchedAt
    ? formatDistanceToNow(new Date(rates[0].fetchedAt), { addSuffix: true })
    : '—';

  return (
    <motion.div
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="visible"
      custom={0.18}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Live Exchange Rates</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <RefreshCw className="size-3" />
          <span style={{ fontSize: '11px' }}>Updated {updatedAgo}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2.5 border-b border-border bg-accent/30">
        <span className="text-muted-foreground" style={{ fontSize: '11px' }}>Gateway fee:</span>
        {RATE_COLOR_LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="size-2 rounded-full" style={{ backgroundColor: color }} />
            <span style={{ fontSize: '11px', color }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: '460px' }}>
          <thead>
            <tr>
              <th
                className="border-r border-border bg-accent/30 px-5 py-3 text-left"
                style={{ width: '130px' }}
              >
                <span
                  className="text-muted-foreground"
                  style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  FROM ╲ TO
                </span>
              </th>
              {PLATFORM_ORDER.map((col) => (
                <th key={col} className="border-r border-border last:border-r-0 px-4 py-3 text-center">
                  <PlatformLabel platform={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLATFORM_ORDER.map((row) => (
              <tr key={row} className="border-t border-border group hover:bg-accent/20 transition-colors duration-100">
                <td className="border-r border-border bg-accent/20 group-hover:bg-accent/30 px-5 py-3.5 transition-colors">
                  <PlatformLabel platform={row} />
                </td>
                {PLATFORM_ORDER.map((col) => {
                  const isSame  = row === col;
                  const spread  = isSame ? null : lookup.get(`${row}_${col}`) ?? null;
                  return (
                    <td key={col} className="border-r border-border last:border-r-0 px-4 py-3.5 text-center">
                      {isSame ? (
                        <span className="text-muted-foreground" style={{ fontSize: '14px' }}>—</span>
                      ) : spread !== null ? (
                        <span
                          className="tabular-nums"
                          style={{ fontSize: '13px', fontWeight: 500, color: getSpreadColor(spread) }}
                        >
                          {(spread * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground" style={{ fontSize: '12px' }}>N/A</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
