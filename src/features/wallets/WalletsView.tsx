// ─────────────────────────────────────────────────────────────────────────────
// OIMES — WalletsView
// Minimalist credit-card UI with gateway toggle per wallet
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ShieldOff, Star, Plus } from 'lucide-react';
import { Switch } from '../../app/components/ui/switch';
import {
  useOIMESStore,
  selectWallets,
  PLATFORM_METADATA,
} from '../../store/index';
import { formatUSD, formatPhoneSomali } from '../../lib/utils';
import { PlatformLogo } from '../../components/PlatformLogo';
import { supabase } from '../../lib/supabase';
import type { Wallet } from '../../types';



// ─── WalletCard ───────────────────────────────────────────────────────────────

function WalletCard({ wallet, index }: { wallet: Wallet; index: number }) {
  const toggleActive   = useOIMESStore(s => s.toggleWalletActive);
  const setDefault     = useOIMESStore(s => s.setDefaultWallet);
  const meta           = PLATFORM_METADATA[wallet.platform];
  const isActive       = wallet.status === 'active';
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState('');

  async function handleTopup() {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0 || amount > 1000) {
      setTopupError('Enter an amount between $1 and $1000');
      return;
    }
    setTopupBusy(true);
    setTopupError('');
    const { error } = await supabase.rpc('simulate_wallet_topup', { p_wallet_id: wallet.id, p_amount: amount });
    setTopupBusy(false);
    if (error) {
      setTopupError(error.message);
    } else {
      setShowTopup(false);
      setTopupAmount('');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'relative rounded-2xl border bg-card overflow-hidden',
        'transition-shadow hover:shadow-md',
        isActive ? 'border-border' : 'border-border/60 opacity-70',
      ].join(' ')}
    >
      {/* Platform color accent strip */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ backgroundColor: meta.brandColor }}
      />

      <div className="pt-5 pb-5 px-5 space-y-5">
        {/* Row 1: Platform identity + toggle */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            {/* Real platform logo */}
            <PlatformLogo platform={wallet.platform} size={36} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>{meta.displayName}</p>
              <p className="text-muted-foreground" style={{ fontSize: '11px' }}>{meta.operator}</p>
            </div>
          </div>

          {/* Gateway toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {isActive
              ? <ShieldCheck className="size-3.5 text-emerald-500" />
              : <ShieldOff className="size-3.5 text-muted-foreground" />
            }
            <Switch
              checked={isActive}
              onCheckedChange={() => toggleActive(wallet.id)}
              aria-label={`${isActive ? 'Disable' : 'Enable'} ${meta.displayName} gateway`}
            />
          </div>
        </div>

        {/* Row 2: Phone number — card-like display */}
        <div>
          <p className="text-muted-foreground mb-1" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Mobile Number
          </p>
          <p
            className="text-foreground"
            style={{ fontSize: '18px', fontWeight: 500, fontFamily: 'ui-monospace, "SF Mono", monospace', letterSpacing: '0.04em' }}
          >
            {formatPhoneSomali(wallet.phoneNumber)}
          </p>
        </div>

        {/* Row 3: Balance + status badges */}
        <div className="flex items-end justify-between pt-1">
          <div className="space-y-1">
            <p className="text-muted-foreground" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Balance
            </p>
            <p
              className="tabular-nums text-foreground"
              style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em' }}
            >
              {formatUSD(wallet.balance.amount)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {/* Status badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                backgroundColor: isActive ? 'var(--status-success-bg)' : 'var(--muted)',
                color: isActive ? 'var(--status-success-fg)' : 'var(--muted-foreground)',
                border: `1px solid ${isActive ? '#6EE7B7' : 'var(--border)'}`,
              }}
            >
              <span
                className="size-1.5 rounded-full inline-block"
                style={{ backgroundColor: isActive ? 'var(--status-success-fg)' : 'var(--muted-foreground)' }}
              />
              {isActive ? 'ACTIVE' : 'SUSPENDED'}
            </span>

            {/* Default badge */}
            {wallet.isDefault && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                <Star className="size-2.5" fill="currentColor" />
                DEFAULT
              </span>
            )}
          </div>
        </div>

        {/* Top up */}
        {isActive && (
          showTopup ? (
            <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              {topupError && <p style={{ fontSize: 11.5, color: 'var(--destructive)' }}>{topupError}</p>}
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount (max $1000)"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  autoFocus
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-background)', fontSize: 13, color: 'var(--foreground)' }}
                />
                <button
                  onClick={handleTopup}
                  disabled={topupBusy}
                  style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-foreground)', background: 'var(--primary)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}
                >
                  {topupBusy ? '…' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowTopup(false); setTopupError(''); }}
                  style={{ fontSize: 12.5, color: 'var(--foreground)', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowTopup(true)}
              className="flex items-center justify-center gap-1.5 w-full"
              style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', cursor: 'pointer', marginTop: 2 }}
            >
              <Plus size={13} /> Top up (demo)
            </button>
          )
        )}

        {/* Set as default link */}
        {!wallet.isDefault && isActive && (
          <button
            onClick={() => setDefault(wallet.id)}
            className="w-full text-center text-muted-foreground hover:text-foreground transition-colors border-t border-border -mx-5 px-5 pt-3.5 -mb-5"
            style={{ fontSize: '12px', marginBottom: '-20px', paddingBottom: '16px' }}
          >
            Set as default send wallet
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── WalletsView ──────────────────────────────────────────────────────────────

export function WalletsView() {
  const wallets = useOIMESStore(selectWallets);
  const totalBalance = wallets.reduce((s, w) => s + w.balance.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-foreground">Wallets</h1>
          <p className="mt-1 text-muted-foreground" style={{ fontSize: '13px' }}>
            Manage your linked mobile money accounts.
          </p>
        </div>
        {/* Total across all */}
        <div className="text-right">
          <p className="text-muted-foreground" style={{ fontSize: '11px' }}>Total</p>
          <p className="tabular-nums text-foreground" style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {formatUSD(totalBalance)}
          </p>
        </div>
      </div>

      {/* Wallet grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {wallets.map((wallet, i) => (
          <WalletCard key={wallet.id} wallet={wallet} index={i} />
        ))}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-accent/40 border border-border">
        <ShieldCheck className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-muted-foreground" style={{ fontSize: '12px' }}>
          Disabling a wallet's gateway prevents it from being used as a source for new exchanges.
          Balances are unaffected. KYC-verified accounts only.
        </p>
      </div>
    </div>
  );
}
