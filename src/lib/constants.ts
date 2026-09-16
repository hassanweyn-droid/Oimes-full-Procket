// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Shared UI Constants
// Static data extracted from component files per Tumaal naming rules:
// "ALWAYS isolate static data into dedicated constants.ts files."
// ─────────────────────────────────────────────────────────────────────────────

import type { MobileMoneyPlatform, TransactionStatus } from '../types';

// ─── Platform display order ────────────────────────────────────────────────────

export const PLATFORM_ORDER: MobileMoneyPlatform[] = [
  'evc_plus',
  'zaad',
  'sahal',
  'edahab',
];

// ─── Transaction status display configuration ──────────────────────────────────

export interface StatusConfig {
  label: string;
  bg: string;
  fg: string;
  border: string;
}

export const STATUS_CONFIG: Record<TransactionStatus, StatusConfig> = {
  completed:  { label: 'COMPLETED',  bg: '#ECFDF5', fg: '#059669', border: '#6EE7B7' },
  pending:    { label: 'PENDING',    bg: '#FFFBEB', fg: '#D97706', border: '#FCD34D' },
  processing: { label: 'PROCESSING', bg: '#EFF6FF', fg: '#2563EB', border: '#93C5FD' },
  failed:     { label: 'FAILED',     bg: '#FEF2F2', fg: '#DC2626', border: '#FCA5A5' },
  cancelled:  { label: 'CANCELLED',  bg: '#F9FAFB', fg: '#6B7280', border: '#D1D5DB' },
  reversed:   { label: 'REVERSED',   bg: '#F9FAFB', fg: '#6B7280', border: '#D1D5DB' },
};

// ─── Exchange rate fee-level legend (used in RatesGrid) ───────────────────────

export const RATE_COLOR_LEGEND = [
  { color: '#059669', label: '1.0%' },
  { color: '#2563EB', label: '1.2%' },
  { color: '#D97706', label: '1.3%' },
  { color: '#DC2626', label: '1.5%' },
] as const;

// ─── Spread color thresholds ──────────────────────────────────────────────────

export function getSpreadColor(spread: number): string {
  if (spread <= 0.010) return '#059669'; // emerald-600 — cheapest tier
  if (spread <= 0.012) return '#2563EB'; // blue-600    — moderate
  if (spread <= 0.013) return '#D97706'; // amber-600   — elevated
  return '#DC2626';                      // red-600     — most expensive
}

// ─── Daily limit ring color thresholds ───────────────────────────────────────

export function getRingColor(pct: number): string {
  if (pct < 50) return '#10B981'; // emerald — healthy headroom
  if (pct < 80) return '#F59E0B'; // amber   — approaching limit
  return '#D4183D';               // red     — near limit
}
