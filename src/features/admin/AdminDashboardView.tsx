// ─────────────────────────────────────────────────────────────────────────────
// OIMES — AdminDashboardView
// The admin's home base: registered users, pending transactions, resolved
// history, an audit log of admin actions, and a live per-user chat — all
// backed by persisted, cross-tab-synced stores so everything here reflects
// what's happening in the customer app in real time.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Users,
  Clock,
  LogOut,
  Check,
  X,
  ArrowLeftRight,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircle,
  Ban,
  PlayCircle,
  Eye,
  Bell,
  Send,
  History,
  LayoutDashboard,
  Percent,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAdminAuthStore, selectCurrentAdmin } from './admin-store';
import { supabaseAdmin } from '../../lib/supabase';
import { useSupabaseUsers } from './use-supabase-users';
import { PLATFORM_METADATA } from '../../store/index';
import { useSupabaseTransactions } from './use-supabase-transactions';
import { useAllSupportMessages, type SupportMessage } from './use-admin-support-chat';
import { useAdminActivityLog, type ActivityLogEntry } from './use-admin-activity';
import { formatUSD } from '../../lib/utils';
import { StatusBadge } from '../history/StatusBadge';
import { PlatformDot } from '../../components/PlatformLogo';
import { AppLogo } from '../../components/AppLogo';
import type { UserProfile, Transaction } from '../../types';

const PAGE_SIZE = 5;

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const iconBtnStyleObj: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--accent)',
  color: 'var(--foreground)',
  cursor: 'pointer',
};

function pagerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: disabled ? 'var(--muted)' : 'var(--accent)',
    color: disabled ? 'var(--muted-foreground)' : 'var(--foreground)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        letterSpacing: '0.03em',
        padding: 0,
      }}
    >
      {label.toUpperCase()}
      <ArrowUpDown size={11} style={{ opacity: active ? 1 : 0.4, transform: active && dir === 'desc' ? 'scaleY(-1)' : 'none' }} />
    </button>
  );
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} style={pagerBtnStyle(page === 1)} aria-label="Previous page">
          <ChevronLeft size={14} />
        </button>
        <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={pagerBtnStyle(page === totalPages)} aria-label="Next page">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative" style={{ maxWidth: 260 }}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          paddingLeft: 32,
          paddingRight: 10,
          paddingTop: 7,
          paddingBottom: 7,
          fontSize: 12.5,
          borderRadius: 7,
          border: '1px solid var(--border)',
          background: 'var(--input-background)',
          color: 'var(--foreground)',
          outline: 'none',
        }}
      />
    </div>
  );
}

interface AdminRateRow {
  id: string;
  from_platform: string;
  to_platform: string;
  rate: number;
  fee_percent: number;
}

interface Toast {
  id: string;
  text: string;
}

type AdminPage = 'overview' | 'transactions' | 'customers' | 'admins' | 'rates' | 'activity';

interface AdminNavItem {
  key: AdminPage;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function AdminDashboardView() {
  const admin = useAdminAuthStore(selectCurrentAdmin);
  const logout = useAdminAuthStore((s) => s.logout);
  const [activePage, setActivePage] = useState<AdminPage>('overview');

  const { transactions, error: txError, approveTransaction, denyTransaction } = useSupabaseTransactions();
  const { users, error: usersError, setActive } = useSupabaseUsers();
  const customers = useMemo(() => users.filter((u) => u.role === 'customer'), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === 'admin' || u.role === 'super_admin'), [users]);
  const pendingKyc = useMemo(() => customers.filter((u) => u.kycStatus === 'pending'), [customers]);

  const { messages: allChatMessages, sendAdminReply } = useAllSupportMessages();

  const { entries: activityEntries, log: logActivity } = useAdminActivityLog();

  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [actionError, setActionError] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [userSort, setUserSort] = useState<{ key: 'name' | 'joined'; dir: 'asc' | 'desc' }>({ key: 'joined', dir: 'desc' });
  const [resolvedSort, setResolvedSort] = useState<{ key: 'date' | 'amount'; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [userPage, setUserPage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [rates, setRates] = useState<AdminRateRow[]>([]);
  const [rateEdits, setRateEdits] = useState<Record<string, { rate: string; fee: string }>>({});
  const [savingRateId, setSavingRateId] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    const { data } = await supabaseAdmin.from('exchange_rates').select('*').order('from_platform');
    if (data) setRates(data as AdminRateRow[]);
  }, []);

  useEffect(() => {
    loadRates();
    const channel = supabaseAdmin
      .channel('admin-rates-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exchange_rates' }, () => loadRates())
      .subscribe();
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [loadRates]);

  useEffect(() => {
    const seeded: Record<string, { rate: string; fee: string }> = {};
    for (const r of rates) seeded[r.id] = { rate: String(r.rate), fee: String(r.fee_percent) };
    setRateEdits(seeded);
  }, [rates]);

  async function saveRate(id: string) {
    const edit = rateEdits[id];
    if (!edit) return;
    setSavingRateId(id);
    const { error } = await supabaseAdmin
      .from('exchange_rates')
      .update({ rate: Number(edit.rate), fee_percent: Number(edit.fee) })
      .eq('id', id);
    setSavingRateId(null);
    const toastId = `toast_rate_${Date.now()}`;
    setToasts((t) => [...t, { id: toastId, text: error ? `Could not save rate: ${error.message}` : 'Rate saved' }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toastId)), 3500);
  }
  const [chatUser, setChatUser] = useState<UserProfile | null>(null);
  const [seenUpTo, setSeenUpTo] = useState<Record<string, number>>({});

  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevPendingCount = useRef<number | null>(null);

  const pending = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'pending')
        .filter((t) => {
          const q = txSearch.trim().toLowerCase();
          if (!q) return true;
          return (
            t.reference.toLowerCase().includes(q) ||
            PLATFORM_METADATA[t.fromWallet.platform].shortCode.toLowerCase().includes(q) ||
            PLATFORM_METADATA[t.toWallet.platform].shortCode.toLowerCase().includes(q) ||
            String(t.fromAmount.amount).includes(q)
          );
        })
        .sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime()),
    [transactions, txSearch]
  );

  useEffect(() => {
    const count = transactions.filter((t) => t.status === 'pending').length;
    if (prevPendingCount.current !== null && count > prevPendingCount.current) {
      const id = `toast_${Date.now()}`;
      setToasts((t) => [...t, { id, text: 'New transaction awaiting approval' }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }
    prevPendingCount.current = count;
  }, [transactions]);

  const resolvedAll = useMemo(() => transactions.filter((t) => t.status === 'completed' || t.status === 'failed'), [transactions]);

  const volumeChartData = useMemo(() => {
    const days: { key: string; label: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: format(d, 'yyyy-MM-dd'), label: format(d, 'MMM d'), total: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const t of transactions) {
      if (t.status !== 'completed' || !t.completedAt) continue;
      const bucket = byKey.get(format(new Date(t.completedAt), 'yyyy-MM-dd'));
      if (bucket) bucket.total += t.fromAmount.amount;
    }
    return days;
  }, [transactions]);

  const resolvedFiltered = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    let list = resolvedAll.filter((t) => {
      if (!q) return true;
      return (
        t.reference.toLowerCase().includes(q) ||
        PLATFORM_METADATA[t.fromWallet.platform].shortCode.toLowerCase().includes(q) ||
        PLATFORM_METADATA[t.toWallet.platform].shortCode.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      const mult = resolvedSort.dir === 'asc' ? 1 : -1;
      if (resolvedSort.key === 'amount') return (a.fromAmount.amount - b.fromAmount.amount) * mult;
      return (new Date(a.initiatedAt).getTime() - new Date(b.initiatedAt).getTime()) * mult;
    });
    return list;
  }, [resolvedAll, txSearch, resolvedSort]);

  const resolvedTotalPages = Math.max(1, Math.ceil(resolvedFiltered.length / PAGE_SIZE));
  const resolvedPageSafe = Math.min(resolvedPage, resolvedTotalPages);
  const resolvedPageItems = resolvedFiltered.slice((resolvedPageSafe - 1) * PAGE_SIZE, resolvedPageSafe * PAGE_SIZE);

  const usersFiltered = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    let list = customers.filter((u) => {
      if (!q) return true;
      return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      const mult = userSort.dir === 'asc' ? 1 : -1;
      if (userSort.key === 'name') return a.displayName.localeCompare(b.displayName) * mult;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mult;
    });
    return list;
  }, [customers, userSearch, userSort]);

  const userTotalPages = Math.max(1, Math.ceil(usersFiltered.length / PAGE_SIZE));
  const userPageSafe = Math.min(userPage, userTotalPages);
  const userPageItems = usersFiltered.slice((userPageSafe - 1) * PAGE_SIZE, userPageSafe * PAGE_SIZE);

  const pendingVolume = pending.reduce((sum, t) => sum + t.fromAmount.amount, 0);

  const totalUnreadChats = useMemo(() => {
    return users.reduce((sum, u) => {
      const seen = seenUpTo[u.id] ?? 0;
      const unread = allChatMessages.filter((m) => m.userId === u.id && m.from === 'user' && new Date(m.createdAt).getTime() > seen).length;
      return sum + unread;
    }, 0);
  }, [users, allChatMessages, seenUpTo]);

  function toggleUserSort(key: 'name' | 'joined') {
    setUserSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  }
  function toggleResolvedSort(key: 'date' | 'amount') {
    setResolvedSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  async function handleApprove(tx: Transaction) {
    setActionError('');
    try {
      await approveTransaction(tx.id);
      await logActivity(admin?.username ?? 'admin', 'approve', `Approved ${tx.reference} (${formatUSD(tx.fromAmount.amount)})`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not approve transaction.');
    }
  }

  async function confirmDeny(tx: Transaction) {
    setActionError('');
    try {
      await denyTransaction(tx.id, denyReason || undefined);
      await logActivity(admin?.username ?? 'admin', 'deny', `Denied ${tx.reference}${denyReason ? ` — ${denyReason}` : ''}`);
      setDenyingId(null);
      setDenyReason('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not deny transaction.');
    }
  }

  async function reviewKycQuick(userId: string, approve: boolean) {
    setActionError('');
    const { error } = await supabaseAdmin.from('users').update({ kyc_status: approve ? 'verified' : 'rejected' }).eq('id', userId);
    if (error) setActionError(error.message);
    else await logActivity(admin?.username ?? 'admin', approve ? 'approve' : 'deny', `${approve ? 'Approved' : 'Rejected'} KYC for user ${userId}`);
  }

  async function handleToggleActive(u: UserProfile) {
    const next = !u.isActive;
    try {
      await setActive(u.id, next);
      await logActivity(admin?.username ?? 'admin', next ? 'activate' : 'suspend', `${next ? 'Reactivated' : 'Suspended'} ${u.displayName} (${u.email})`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update this user.');
    }
  }

  function openChat(u: UserProfile) {
    setChatUser(u);
    setSeenUpTo((s) => ({ ...s, [u.id]: Date.now() }));
  }

  const navItems: AdminNavItem[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} />, badge: pending.length + pendingKyc.length },
    { key: 'transactions', label: 'Transactions', icon: <ArrowLeftRight size={16} /> },
    { key: 'customers', label: 'Customers', icon: <Users size={16} />, badge: totalUnreadChats },
    { key: 'admins', label: 'Admins', icon: <ShieldCheck size={16} /> },
    { key: 'rates', label: 'Exchange rates', icon: <Percent size={16} /> },
    { key: 'activity', label: 'Activity log', icon: <History size={16} /> },
  ];

  const pageMeta: Record<AdminPage, { title: string; subtitle: string }> = {
    overview: { title: 'Overview', subtitle: `Signed in as ${admin?.username ?? 'admin'} · ${(admin?.role ?? 'admin').replace('_', ' ')}` },
    transactions: { title: 'Transactions', subtitle: 'Full history of resolved exchange requests.' },
    customers: { title: 'Customers', subtitle: 'Everyone registered on the platform.' },
    admins: { title: 'Admins', subtitle: 'Accounts with access to this dashboard.' },
    rates: { title: 'Exchange rates', subtitle: 'Rates customers see live in the app.' },
    activity: { title: 'Activity log', subtitle: 'Actions taken by admins on this account.' },
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar page={activePage} onPage={setActivePage} admin={admin} onLogout={logout} navItems={navItems} />

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ background: 'var(--foreground)', color: 'var(--background)', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
            >
              <Bell size={14} /> {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <AdminMobileNav page={activePage} onPage={setActivePage} navItems={navItems} />

        <header className="flex items-center justify-between px-6 border-b border-border bg-background" style={{ height: 60, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>{pageMeta[activePage].title}</h1>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{pageMeta[activePage].subtitle}</p>
          </div>
          <button
            onClick={logout}
            className="md:hidden flex items-center gap-1.5"
            style={{ fontSize: 13, color: 'var(--foreground)', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}
          >
            <LogOut size={14} />
          </button>
        </header>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col gap-8">
        {actionError && (
          <div style={{ background: 'var(--error-banner-bg)', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--destructive)' }}>{actionError}</div>
        )}

        {activePage === 'overview' && (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users size={16} />} label="Registered customers" value={String(customers.length)} />
          <StatCard icon={<ShieldCheck size={16} />} label="Admin accounts" value={String(admins.length)} accent="#0C447C" />
          <StatCard icon={<Clock size={16} />} label="Pending transactions" value={String(pending.length)} accent="#D97706" />
          <StatCard icon={<ArrowLeftRight size={16} />} label="Pending volume" value={formatUSD(pendingVolume)} accent="var(--primary)" />
        </div>

        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Transaction volume</h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>Completed exchanges over the last 14 days.</p>
          </div>
          <div className="px-5 py-4">
            <VolumeChart data={volumeChartData} />
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl overflow-hidden">
          {txError && (
            <div className="px-5 py-3" style={{ background: 'var(--error-banner-bg)', borderBottom: '1px solid #FCA5A5', fontSize: 12.5, color: 'var(--destructive)' }}>
              Could not load transactions: {txError}
            </div>
          )}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Pending transactions</h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>Approve to release funds, or deny to cancel the request. The customer sees the decision immediately.</p>
            </div>
            <SearchInput value={txSearch} onChange={setTxSearch} placeholder="Search reference, platform…" />
          </div>

          {pending.length === 0 ? (
            <div className="px-5 py-10 text-center" style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Nothing waiting on approval right now.</div>
          ) : (
            <div>
              {pending.map((tx) => {
                const fromMeta = PLATFORM_METADATA[tx.fromWallet.platform];
                const toMeta = PLATFORM_METADATA[tx.toWallet.platform];
                const isDenying = denyingId === tx.id;
                return (
                  <motion.div key={tx.id} layout className="px-5 py-4 flex flex-col gap-3 border-b border-border last:border-b-0">
                    <div className="flex items-center flex-wrap gap-4">
                      <div style={{ minWidth: 140 }}>
                        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{format(new Date(tx.initiatedAt), 'dd MMM yyyy, HH:mm')}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'ui-monospace, monospace' }}>{tx.reference}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PlatformDot platform={tx.fromWallet.platform} size={15} />
                        <span style={{ fontSize: 12.5, color: 'var(--foreground)', fontWeight: 500 }}>{fromMeta.shortCode}</span>
                        <ArrowLeftRight size={12} color="var(--muted-foreground)" />
                        <PlatformDot platform={tx.toWallet.platform} size={15} />
                        <span style={{ fontSize: 12.5, color: 'var(--foreground)', fontWeight: 500 }}>{toMeta.shortCode}</span>
                      </div>
                      <div className="flex-1 text-right">
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)' }}>{formatUSD(tx.fromAmount.amount)} → {formatUSD(tx.toAmount.amount)}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>fee {formatUSD(tx.fee.total.amount)}</p>
                      </div>
                      <StatusBadge status={tx.status} />
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApprove(tx)} className="flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--status-success-fg)', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: 'pointer' }}>
                          <Check size={14} /> Approve
                        </button>
                        <button onClick={() => setDenyingId(isDenying ? null : tx.id)} className="flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--destructive)', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: 'pointer' }}>
                          <X size={14} /> Deny
                        </button>
                      </div>
                    </div>
                    {isDenying && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Reason for denial (optional)"
                          value={denyReason}
                          onChange={(e) => setDenyReason(e.target.value)}
                          style={{ flex: 1, fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--input-background)', color: 'var(--foreground)', outline: 'none' }}
                        />
                        <button onClick={() => confirmDeny(tx)} style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--destructive)', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: 'pointer' }}>Confirm deny</button>
                        <button onClick={() => { setDenyingId(null); setDenyReason(''); }} style={{ fontSize: 12.5, color: 'var(--foreground)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', cursor: 'pointer' }}>Cancel</button>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {pendingKyc.length > 0 && (
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Pending KYC reviews</h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>{pendingKyc.length} customer{pendingKyc.length === 1 ? '' : 's'} waiting on identity verification.</p>
            </div>
            <div>
              {pendingKyc.map((u) => (
                <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-4 border-b border-border last:border-b-0">
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{u.displayName}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{u.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewKycQuick(u.id, true)}
                      style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--status-success-fg)', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: 'pointer' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reviewKycQuick(u.id, false)}
                      style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--destructive)', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: 'pointer' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </>
        )}

        {activePage === 'transactions' && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Recently resolved</h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>{resolvedFiltered.length} decision{resolvedFiltered.length === 1 ? '' : 's'} on this account.</p>
            </div>
            <button
              onClick={() =>
                downloadCSV('oimes-transactions.csv', [
                  ['Date', 'Reference', 'From', 'To', 'Amount', 'Status'],
                  ...resolvedFiltered.map((t) => [
                    format(new Date(t.initiatedAt), 'yyyy-MM-dd HH:mm'),
                    t.reference,
                    PLATFORM_METADATA[t.fromWallet.platform].shortCode,
                    PLATFORM_METADATA[t.toWallet.platform].shortCode,
                    t.fromAmount.amount,
                    t.status,
                  ]),
                ])
              }
              className="flex items-center gap-1.5"
              style={{ fontSize: 12.5, color: 'var(--foreground)', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 11px', cursor: 'pointer' }}
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          {resolvedFiltered.length === 0 ? (
            <div className="px-5 py-8 text-center" style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No resolved transactions yet.</div>
          ) : (
            <>
              <div className="px-5 py-2 flex items-center gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <SortHeader label="Date" active={resolvedSort.key === 'date'} dir={resolvedSort.dir} onClick={() => toggleResolvedSort('date')} />
                <SortHeader label="Amount" active={resolvedSort.key === 'amount'} dir={resolvedSort.dir} onClick={() => toggleResolvedSort('amount')} />
              </div>
              <div>
                {resolvedPageItems.map((tx) => {
                  const fromMeta = PLATFORM_METADATA[tx.fromWallet.platform];
                  const toMeta = PLATFORM_METADATA[tx.toWallet.platform];
                  return (
                    <div key={tx.id} className="px-5 py-3 flex items-center flex-wrap gap-4 border-b border-border last:border-b-0">
                      <div style={{ minWidth: 140 }}>
                        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{format(new Date(tx.initiatedAt), 'dd MMM yyyy, HH:mm')}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'ui-monospace, monospace' }}>{tx.reference}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PlatformDot platform={tx.fromWallet.platform} size={14} />
                        <span style={{ fontSize: 12.5, color: 'var(--foreground)' }}>{fromMeta.shortCode}</span>
                        <ArrowLeftRight size={11} color="var(--muted-foreground)" />
                        <PlatformDot platform={tx.toWallet.platform} size={14} />
                        <span style={{ fontSize: 12.5, color: 'var(--foreground)' }}>{toMeta.shortCode}</span>
                      </div>
                      <div className="flex-1 text-right">
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{formatUSD(tx.fromAmount.amount)}</p>
                      </div>
                      <StatusBadge status={tx.status} />
                    </div>
                  );
                })}
              </div>
              <Pager page={resolvedPageSafe} totalPages={resolvedTotalPages} onPage={setResolvedPage} />
            </>
          )}
        </section>
        )}

        {activePage === 'customers' && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          {usersError && (
            <div className="px-5 py-3" style={{ background: 'var(--error-banner-bg)', borderBottom: '1px solid #FCA5A5', fontSize: 12.5, color: 'var(--destructive)' }}>
              Could not load users: {usersError}
            </div>
          )}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Registered customers</h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>{usersFiltered.length} customer account{usersFiltered.length === 1 ? '' : 's'} on the platform.</p>
            </div>
            <div className="flex items-center gap-2">
              <SearchInput value={userSearch} onChange={setUserSearch} placeholder="Search name or email…" />
              <button
                onClick={() =>
                  downloadCSV('oimes-customers.csv', [
                    ['Name', 'Email', 'Phone', 'Role', 'KYC', 'Status', 'Joined'],
                    ...usersFiltered.map((u) => [u.displayName, u.email, u.phone ?? '', u.role, u.kycStatus, u.isActive ? 'Active' : 'Suspended', format(new Date(u.createdAt), 'yyyy-MM-dd')]),
                  ])
                }
                className="flex items-center gap-1.5"
                style={{ fontSize: 12.5, color: 'var(--foreground)', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 11px', cursor: 'pointer' }}
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2.5"><SortHeader label="Name" active={userSort.key === 'name'} dir={userSort.dir} onClick={() => toggleUserSort('name')} /></th>
                  <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>EMAIL</th>
                  <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>KYC</th>
                  <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>STATUS</th>
                  <th className="text-left px-5 py-2.5"><SortHeader label="Joined" active={userSort.key === 'joined'} dir={userSort.dir} onClick={() => toggleUserSort('joined')} /></th>
                  <th className="text-right px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {userPageItems.map((u) => {
                  const unread = allChatMessages.filter((m) => m.userId === u.id && m.from === 'user' && new Date(m.createdAt).getTime() > (seenUpTo[u.id] ?? 0)).length;
                  return (
                    <tr key={u.id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-3">
                        <button onClick={() => setSelectedUser(u)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--foreground)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                          {u.displayName}
                        </button>
                      </td>
                      <td className="px-5 py-3" style={{ fontSize: 13, color: 'var(--foreground)' }}>{u.email}</td>
                      <td className="px-5 py-3" style={{ fontSize: 12.5, color: 'var(--foreground)', textTransform: 'capitalize' }}>{u.kycStatus}</td>
                      <td className="px-5 py-3">
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: u.isActive ? 'var(--status-success-bg)' : 'var(--status-danger-bg)', color: u.isActive ? 'var(--status-success-fg)' : 'var(--status-danger-fg)' }}>
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>{format(new Date(u.createdAt), 'dd MMM yyyy')}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setSelectedUser(u)} aria-label="View details" style={iconBtnStyleObj}><Eye size={14} /></button>
                          <button onClick={() => openChat(u)} aria-label="Chat" style={{ ...iconBtnStyleObj, position: 'relative' }}>
                            <MessageCircle size={14} />
                            {unread > 0 && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--destructive)' }} />}
                          </button>
                          <button onClick={() => handleToggleActive(u)} aria-label={u.isActive ? 'Suspend user' : 'Activate user'} style={iconBtnStyleObj}>
                            {u.isActive ? <Ban size={14} /> : <PlayCircle size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={userPageSafe} totalPages={userTotalPages} onPage={setUserPage} />
        </section>
        )}

        {activePage === 'admins' && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Registered admins</h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>{admins.length} admin account{admins.length === 1 ? '' : 's'} with access to this dashboard.</p>
          </div>
          {admins.length === 0 ? (
            <div className="px-5 py-8 text-center" style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No admin accounts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>NAME</th>
                    <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>EMAIL</th>
                    <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>ROLE</th>
                    <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>STATUS</th>
                    <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>JOINED</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-3" style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500 }}>{a.displayName}</td>
                      <td className="px-5 py-3" style={{ fontSize: 13, color: 'var(--foreground)' }}>{a.email}</td>
                      <td className="px-5 py-3" style={{ fontSize: 12.5, color: 'var(--foreground)', textTransform: 'capitalize' }}>{a.role.replace('_', ' ')}</td>
                      <td className="px-5 py-3">
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: a.isActive ? 'var(--status-success-bg)' : 'var(--status-danger-bg)', color: a.isActive ? 'var(--status-success-fg)' : 'var(--status-danger-fg)' }}>
                          {a.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>{format(new Date(a.createdAt), 'dd MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}

        {activePage === 'rates' && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Exchange rates</h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>Rates customers see live in the app. Edit and save to update instantly.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>PAIR</th>
                  <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>RATE</th>
                  <th className="text-left px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>FEE %</th>
                  <th className="text-right px-5 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}></th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => {
                  const edit = rateEdits[r.id] ?? { rate: String(r.rate), fee: String(r.fee_percent) };
                  const fromMeta = PLATFORM_METADATA[r.from_platform as keyof typeof PLATFORM_METADATA];
                  const toMeta = PLATFORM_METADATA[r.to_platform as keyof typeof PLATFORM_METADATA];
                  return (
                    <tr key={r.id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-2.5" style={{ fontSize: 12.5, color: 'var(--foreground)' }}>
                        {fromMeta?.shortCode ?? r.from_platform} → {toMeta?.shortCode ?? r.to_platform}
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          step="0.0001"
                          value={edit.rate}
                          onChange={(e) => setRateEdits((s) => ({ ...s, [r.id]: { ...edit, rate: e.target.value } }))}
                          style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-background)', fontSize: 12.5 }}
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          step="0.001"
                          value={edit.fee}
                          onChange={(e) => setRateEdits((s) => ({ ...s, [r.id]: { ...edit, fee: e.target.value } }))}
                          style={{ width: 80, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-background)', fontSize: 12.5 }}
                        />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <button
                          onClick={() => saveRate(r.id)}
                          disabled={savingRateId === r.id}
                          style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--primary)', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                        >
                          {savingRateId === r.id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {activePage === 'activity' && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
              <History size={15} /> Activity log
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2 }}>Actions taken by admins on this account.</p>
          </div>
          {activityEntries.length === 0 ? (
            <div className="px-5 py-8 text-center" style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No admin actions logged yet.</div>
          ) : (
            <div>
              {activityEntries.slice(0, 50).map((entry: ActivityLogEntry) => (
                <div key={entry.id} className="px-5 py-3 flex items-center justify-between gap-4 border-b border-border last:border-b-0">
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--foreground)' }}>
                      <strong style={{ fontWeight: 600 }}>{entry.adminUsername}</strong> {entry.detail}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{format(new Date(entry.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                  </div>
                  <ActionTag action={entry.action} />
                </div>
              ))}
            </div>
          )}
        </section>
        )}
      </div>
      </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <ModalShell onClose={() => setSelectedUser(null)}>
            <UserDetailPanel
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onChat={() => { const u = selectedUser; setSelectedUser(null); openChat(u); }}
              onToggleActive={() => handleToggleActive(selectedUser)}
              onUserChanged={() => setSelectedUser(null)}
            />
          </ModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatUser && (
          <ModalShell onClose={() => setChatUser(null)}>
            <ChatPanel
              user={chatUser}
              adminName={admin?.username ?? 'admin'}
              messages={allChatMessages.filter((m) => m.userId === chatUser.id)}
              onSend={(text) => sendAdminReply(chatUser.id, text, admin?.username ?? 'admin')}
              onClose={() => setChatUser(null)}
            />
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sidebar navigation (desktop) ───────────────────────────────────────────
function AdminSidebar({
  page,
  onPage,
  admin,
  onLogout,
  navItems,
}: {
  page: AdminPage;
  onPage: (p: AdminPage) => void;
  admin: { username: string; role: string } | null;
  onLogout: () => void;
  navItems: AdminNavItem[];
}) {
  return (
    <aside
      className="hidden md:flex flex-col"
      style={{ width: 232, flexShrink: 0, background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)', height: '100vh', position: 'sticky', top: 0 }}
    >
      <div className="flex items-center gap-2.5 px-5" style={{ height: 60, borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
        <div className="flex items-center justify-center rounded-xl" style={{ width: 32, height: 32, background: 'var(--sidebar-primary)', flexShrink: 0 }}>
          <AppLogo size={18} />
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--sidebar-foreground)' }}>OIMES</span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--sidebar-primary)',
              background: 'var(--sidebar-accent)',
              borderRadius: 4,
              padding: '1.5px 5px',
            }}
          >
            ADMIN
          </span>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3 py-4" style={{ overflowY: 'auto' }}>
        {navItems.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onPage(item.key)}
              className="flex items-center gap-2.5"
              style={{
                textAlign: 'left',
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--sidebar-primary-foreground)' : 'var(--sidebar-foreground)',
                background: active ? 'var(--sidebar-primary)' : 'transparent',
                border: 'none',
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
              }}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 999,
                    background: active ? 'rgba(255,255,255,0.25)' : 'var(--destructive)',
                    color: active ? 'var(--sidebar-primary-foreground)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4" style={{ borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
        <div className="flex items-center gap-2.5 px-2" style={{ marginBottom: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--sidebar-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--sidebar-accent-foreground)',
              flexShrink: 0,
            }}
          >
            {(admin?.username ?? 'A').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sidebar-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {admin?.username}
            </p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>{admin?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-1.5 w-full"
          style={{ fontSize: 12.5, color: 'var(--sidebar-foreground)', background: 'var(--sidebar-accent)', border: '1px solid var(--sidebar-border)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}
        >
          <LogOut size={13} /> Log out
        </button>
      </div>
    </aside>
  );
}

// ─── Nav strip (mobile — sidebar is hidden below md) ────────────────────────
function AdminMobileNav({ page, onPage, navItems }: { page: AdminPage; onPage: (p: AdminPage) => void; navItems: AdminNavItem[] }) {
  return (
    <div className="flex md:hidden items-center gap-1.5 px-4 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', overflowX: 'auto', flexShrink: 0 }}>
      {navItems.map((item) => {
        const active = page === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onPage(item.key)}
            className="flex items-center gap-1.5"
            style={{
              flexShrink: 0,
              fontSize: 12.5,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
              background: active ? 'var(--primary)' : 'var(--accent)',
              border: 'none',
              borderRadius: 999,
              padding: '6px 12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {item.icon}
            {item.label}
            {!!item.badge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 15,
                  height: 15,
                  borderRadius: 999,
                  background: active ? 'rgba(255,255,255,0.3)' : 'var(--destructive)',
                  color: active ? 'var(--primary-foreground)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Overview transaction-volume chart ──────────────────────────────────────
function VolumeChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="oimesVolumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={2} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
            formatter={(value: number) => [formatUSD(value), 'Volume']}
          />
          <Area type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={2} fill="url(#oimesVolumeFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActionTag({ action }: { action: ActivityLogEntry['action'] }) {
  const map: Record<ActivityLogEntry['action'], [string, string, string]> = {
    approve: ['var(--status-success-bg)', 'var(--status-success-fg)', 'Approved'],
    deny: ['var(--status-danger-bg)', 'var(--status-danger-fg)', 'Denied'],
    suspend: ['var(--status-warning-bg)', 'var(--status-warning-fg)', 'Suspended'],
    activate: ['var(--status-info-bg)', 'var(--status-info-fg)', 'Activated'],
    adjust: ['var(--status-purple-bg)', 'var(--status-purple-fg)', 'Adjusted'],
  };
  const [bg, fg, label] = map[action];
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: bg, color: fg, flexShrink: 0 }}>{label}</span>;
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', width: '100%', maxWidth: 440, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

interface AdminWalletRow {
  id: string;
  platform: string;
  balance: number;
  currency: string;
  status: string;
}

function UserDetailPanel({ user, onClose, onChat, onToggleActive, onUserChanged }: { user: UserProfile; onClose: () => void; onChat: () => void; onToggleActive: () => void; onUserChanged: () => void }) {
  const [wallets, setWallets] = useState<AdminWalletRow[]>([]);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState('');

  const loadWallets = useCallback(async () => {
    const { data } = await supabaseAdmin.from('wallets').select('*').eq('user_id', user.id);
    if (data) setWallets(data as AdminWalletRow[]);
  }, [user.id]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  async function reviewKyc(approve: boolean) {
    setBusy(true);
    setPanelError('');
    const { error } = await supabaseAdmin.from('users').update({ kyc_status: approve ? 'verified' : 'rejected' }).eq('id', user.id);
    if (error) setPanelError(error.message);
    else onUserChanged();
    setBusy(false);
  }

  async function submitAdjustment(walletId: string) {
    const amount = Number(adjustAmount);
    if (!amount || Number.isNaN(amount)) {
      setPanelError('Enter a non-zero amount.');
      return;
    }
    setBusy(true);
    setPanelError('');
    const { error } = await supabaseAdmin.rpc('admin_adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_amount: amount,
      p_reason: adjustReason || 'Manual adjustment',
    });
    if (error) {
      setPanelError(error.message);
    } else {
      setAdjustingId(null);
      setAdjustAmount('');
      setAdjustReason('');
      loadWallets();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{user.displayName}</h3>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={18} /></button>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Phone" value={user.phone ?? '—'} />
        <DetailRow label="Role" value={user.role} />
        <DetailRow label="KYC status" value={user.kycStatus} />
        <DetailRow label="Account status" value={user.isActive ? 'Active' : 'Suspended'} />
        <DetailRow label="Joined" value={format(new Date(user.createdAt), 'dd MMM yyyy')} />

        {user.kycStatus === 'pending' && (
          <div className="flex gap-2" style={{ marginTop: 4 }}>
            <button
              onClick={() => reviewKyc(true)}
              disabled={busy}
              className="flex-1"
              style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--status-success-fg)', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer' }}
            >
              Approve KYC
            </button>
            <button
              onClick={() => reviewKyc(false)}
              disabled={busy}
              className="flex-1"
              style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--destructive)', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer' }}
            >
              Reject KYC
            </button>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>WALLETS ({wallets.length})</p>
          {wallets.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>No wallets linked yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {wallets.map((w) => (
                <div key={w.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 12.5, textTransform: 'capitalize' }}>{w.platform.replace('_', ' ')}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{formatUSD(Number(w.balance))}</span>
                  </div>
                  {adjustingId === w.id ? (
                    <div className="flex flex-col gap-1.5" style={{ marginTop: 8 }}>
                      <input
                        type="number"
                        placeholder="+10 or -10"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-background)', fontSize: 12.5 }}
                      />
                      <input
                        type="text"
                        placeholder="Reason"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-background)', fontSize: 12.5 }}
                      />
                      <div className="flex gap-1.5">
                        <button onClick={() => submitAdjustment(w.id)} disabled={busy} style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--primary)', border: 'none', borderRadius: 6, padding: '6px', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setAdjustingId(null)} style={{ flex: 1, fontSize: 12, color: 'var(--foreground)', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAdjustingId(w.id)} style={{ marginTop: 6, fontSize: 11.5, color: 'var(--primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                      Adjust balance
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {panelError && <p style={{ fontSize: 12, color: 'var(--destructive)' }}>{panelError}</p>}
      </div>
      <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={onChat} className="flex items-center justify-center gap-1.5 flex-1" style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--primary)', border: 'none', borderRadius: 8, padding: '9px 12px', cursor: 'pointer' }}>
          <MessageCircle size={14} /> Chat
        </button>
        <button onClick={onToggleActive} className="flex items-center justify-center gap-1.5 flex-1" style={{ fontSize: 13, fontWeight: 600, color: user.isActive ? 'var(--status-danger-fg)' : 'var(--status-success-fg)', background: user.isActive ? 'var(--status-danger-bg)' : 'var(--status-success-bg)', border: 'none', borderRadius: 8, padding: '9px 12px', cursor: 'pointer' }}>
          {user.isActive ? <Ban size={14} /> : <PlayCircle size={14} />} {user.isActive ? 'Suspend' : 'Activate'}
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500, textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}

function ChatPanel({ user, adminName, messages, onSend, onClose }: { user: UserProfile; adminName: string; messages: SupportMessage[]; onSend: (text: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="flex flex-col" style={{ height: 480 }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{user.displayName}</h3>
          <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{user.email}</p>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={18} /></button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', marginTop: 30 }}>No messages with this customer yet.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.from === 'admin' ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                padding: '9px 13px',
                borderRadius: m.from === 'admin' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                background: m.from === 'admin' ? 'var(--primary)' : 'var(--muted)',
                color: m.from === 'admin' ? 'var(--primary-foreground)' : 'var(--foreground)',
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.6, display: 'block', marginBottom: 2 }}>
                {m.from === 'admin' ? `You (${m.senderName ?? adminName})` : user.displayName}
              </span>
              {m.text}
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Reply to this customer…"
          style={{ flex: 1, padding: '9px 13px', borderRadius: 20, border: '1.5px solid var(--border)', background: 'var(--input-background)', color: 'var(--foreground)', fontSize: 13, outline: 'none' }}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim()}
          aria-label="Send reply"
          style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: draft.trim() ? 'var(--primary)' : 'var(--muted)', color: draft.trim() ? 'var(--primary-foreground)' : 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: draft.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent = 'var(--primary)' }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl" style={{ padding: '16px 18px' }}>
      <div className="flex items-center gap-2" style={{ color: accent, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)' }}>{value}</p>
    </div>
  );
}
