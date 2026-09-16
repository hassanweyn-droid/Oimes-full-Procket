// ─────────────────────────────────────────────────────────────────────────────
// OIMES — DailyLimitCard
// Daily exchange limit tracker with animated ring and progress bar.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { useOIMESStore } from '../../store/index';
import { formatUSD } from '../../lib/utils';
import { getRingColor } from '../../lib/constants';
import { CARD_VARIANTS } from './DashboardView';

// ─── Ring constants ───────────────────────────────────────────────────────────

const RING_R    = 44;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 276.46

// ─── LimitRing ────────────────────────────────────────────────────────────────

function LimitRing({ pct }: { pct: number }) {
  const dashOffset = RING_CIRC * (1 - Math.min(pct, 100) / 100);
  const color = getRingColor(pct);

  return (
    <svg viewBox="0 0 120 120" width={120} height={120} aria-hidden="true">
      <circle cx={60} cy={60} r={RING_R} fill="none" stroke="var(--accent)" strokeWidth={9} />
      <motion.circle
        cx={60} cy={60} r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={RING_CIRC}
        initial={{ strokeDashoffset: RING_CIRC }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        transform="rotate(-90 60 60)"
      />
    </svg>
  );
}

// ─── DailyLimitCard ───────────────────────────────────────────────────────────

export function DailyLimitCard() {
  // Selecting primitives individually avoids returning a new object reference
  // on every render, which would cause useSyncExternalStore to loop infinitely.
  const spent = useOIMESStore((s) => s.dailySpentUSD);
  const limit = useOIMESStore((s) => s.dailyLimitUSD);
  const remaining      = Math.round((limit - spent) * 100) / 100;
  const utilizationPct = Math.min(100, Math.round((spent / limit) * 100));
  const color = getRingColor(utilizationPct);

  return (
    <motion.div
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="visible"
      custom={0.09}
      className="rounded-2xl border border-border bg-card p-6 flex flex-col"
    >
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="size-4 text-muted-foreground" strokeWidth={1.75} />
        <span
          className="text-muted-foreground"
          style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Daily Exchange Limit
        </span>
      </div>

      <div className="flex items-center gap-5 mb-5">
        <div className="relative shrink-0">
          <LimitRing pct={utilizationPct} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="tabular-nums text-foreground" style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.15 }}>
              {utilizationPct}%
            </span>
            <span className="text-muted-foreground" style={{ fontSize: '10px', marginTop: '2px' }}>used</span>
          </div>
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <p className="text-muted-foreground" style={{ fontSize: '11px' }}>Remaining today</p>
            <p className="tabular-nums text-foreground" style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              {formatUSD(remaining)}
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between" style={{ fontSize: '12px' }}>
              <span className="text-muted-foreground">Spent</span>
              <span className="tabular-nums text-foreground" style={{ fontWeight: 500 }}>{formatUSD(spent)}</span>
            </div>
            <div className="flex items-center justify-between" style={{ fontSize: '12px' }}>
              <span className="text-muted-foreground">Daily limit</span>
              <span className="tabular-nums text-foreground" style={{ fontWeight: 500 }}>{formatUSD(limit)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-1.5 w-full rounded-full bg-accent overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${utilizationPct}%` }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between text-muted-foreground" style={{ fontSize: '10px' }}>
          <span>$0</span>
          <span>{formatUSD(limit / 2)}</span>
          <span>{formatUSD(limit)}</span>
        </div>
      </div>
    </motion.div>
  );
}
