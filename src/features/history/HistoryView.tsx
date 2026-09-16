// ─────────────────────────────────────────────────────────────────────────────
// OIMES — HistoryView
// Searchable transaction list — composition shell.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { Search, Clock, X } from 'lucide-react';
import { useOIMESStore, selectTransactions, PLATFORM_METADATA } from '../../store/index';
import { TxRow } from './TxRow';

// ─── HistoryView ──────────────────────────────────────────────────────────────

export function HistoryView() {
  const transactions = useOIMESStore(selectTransactions);
  const [search,     setSearch]     = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase().trim();
    return transactions.filter(
      (tx) =>
        tx.reference.toLowerCase().includes(q) ||
        tx.fromWallet.phoneNumber.includes(q) ||
        tx.toWallet.phoneNumber.includes(q) ||
        tx.id.toLowerCase().includes(q) ||
        PLATFORM_METADATA[tx.fromWallet.platform].displayName.toLowerCase().includes(q) ||
        PLATFORM_METADATA[tx.toWallet.platform].displayName.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-foreground">Transaction History</h1>
        <p className="mt-1 text-muted-foreground" style={{ fontSize: '13px' }}>
          Full ledger of all exchanges. Click any row for a detailed receipt.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by phone number, reference, or platform…"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/40 transition-all placeholder:text-muted-foreground/50"
          style={{ fontSize: '13px' }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="hidden sm:flex items-center gap-3 px-5 py-2">
          {[
            { label: 'Date',         style: { width: '100px' } },
            { label: 'Reference',    style: { width: '130px' }, hideOnMd: true },
            { label: 'Route',        style: {} },
            { label: 'Sent / Received', style: { marginLeft: 'auto', textAlign: 'right' as const } },
            { label: 'Status',       style: {} },
          ].map(({ label, style, hideOnMd }) => (
            <div
              key={label}
              className={hideOnMd ? 'hidden md:block shrink-0 text-muted-foreground' : 'shrink-0 text-muted-foreground'}
              style={{ ...style, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              {label}
            </div>
          ))}
          <div style={{ width: '16px' }} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <div className="flex items-center justify-center size-11 rounded-full bg-accent">
              <Clock className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p style={{ fontSize: '13px' }} className="text-foreground">
                {search ? 'No transactions match your search.' : 'No transactions yet.'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
                  style={{ fontSize: '12px' }}
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                expanded={expandedId === tx.id}
                onToggle={() => toggleExpand(tx.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {transactions.length > 0 && (
        <p className="text-muted-foreground text-right" style={{ fontSize: '11px' }}>
          {filtered.length === transactions.length
            ? `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${transactions.length} transactions`}
        </p>
      )}
    </div>
  );
}
