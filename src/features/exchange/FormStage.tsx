// ─────────────────────────────────────────────────────────────────────────────
// OIMES — FormStage
// Exchange form: wallet selectors, amount input, preview, and CTA.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeftRight, AlertCircle, ShieldCheck } from 'lucide-react';
import {
  useOIMESStore,
  selectWallets,
  selectExchangeRates,
  PLATFORM_METADATA,
} from '../../store/index';
import { formatUSD, round2 } from '../../lib/utils';
import { WalletDropdown } from './WalletDropdown';
import { CostBreakdown } from './CostBreakdown';

interface FormStageProps {
  onContinue: (otp: string, fromId: string, toId: string, amount: number) => void;
}

export function FormStage({ onContinue }: FormStageProps) {
  const wallets    = useOIMESStore(selectWallets);
  const rates      = useOIMESStore(selectExchangeRates);
  const dailySpent = useOIMESStore((s) => s.dailySpentUSD);
  const dailyLimit = useOIMESStore((s) => s.dailyLimitUSD);

  const defaultWallet = wallets.find((w) => w.isDefault) ?? wallets[0];
  const otherWallet   = wallets.find((w) => w.id !== defaultWallet.id) ?? wallets[1];

  const [fromId, setFromId] = useState(defaultWallet.id);
  const [toId,   setToId]   = useState(otherWallet.id);
  const [amount, setAmount] = useState('');

  const fromWallet = wallets.find((w) => w.id === fromId)!;
  const toWallet   = wallets.find((w) => w.id === toId)!;

  const activeRate = useMemo(
    () => rates.find((r) => r.fromPlatform === fromWallet?.platform && r.toPlatform === toWallet?.platform),
    [rates, fromWallet?.platform, toWallet?.platform]
  );

  const numAmount   = parseFloat(amount) || 0;
  const dailyRemain = round2(dailyLimit - dailySpent);
  const fromMeta    = PLATFORM_METADATA[fromWallet.platform];
  const showPreview = numAmount > 0 && fromId !== toId && !!activeRate;

  const validationError = useMemo(() => {
    if (!numAmount) return null;
    if (fromId === toId) return 'Cannot exchange between the same platform.';
    if (fromWallet.status !== 'active') return 'Source wallet is suspended.';
    if (!activeRate) return 'No exchange rate available for this pair.';
    if (numAmount < fromMeta.transferLimits.min) return `Minimum transfer is ${formatUSD(fromMeta.transferLimits.min)}.`;
    if (numAmount > fromMeta.transferLimits.max) return `Single transfer limit is ${formatUSD(fromMeta.transferLimits.max)}.`;
    if (numAmount > fromWallet.balance.amount) return `Insufficient balance — available: ${formatUSD(fromWallet.balance.amount)}.`;
    if (numAmount > dailyRemain) return `Exceeds daily limit — remaining: ${formatUSD(dailyRemain)}.`;
    return null;
  }, [numAmount, fromId, toId, fromWallet, activeRate, fromMeta, dailyRemain]);

  const canSubmit = numAmount > 0 && !validationError && fromId !== toId && !!activeRate;

  const handleSwap = () => {
    const tmp = fromId;
    setFromId(toId);
    setToId(tmp);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    onContinue(otp, fromId, toId, numAmount);
  };

  return (
    <div className="space-y-4">
      <WalletDropdown
        label="From"
        selectedId={fromId}
        wallets={wallets.filter((w) => w.status === 'active')}
        excludeId={toId}
        onChange={setFromId}
      />
      <div className="flex justify-center">
        <button
          onClick={handleSwap}
          className="flex items-center justify-center size-9 rounded-full border border-border bg-background hover:bg-accent transition-colors"
          aria-label="Swap wallets"
        >
          <ArrowLeftRight className="size-4 text-muted-foreground" />
        </button>
      </div>
      <WalletDropdown
        label="To"
        selectedId={toId}
        wallets={wallets}
        excludeId={fromId}
        onChange={setToId}
      />

      <div>
        <p
          className="mb-1.5 text-muted-foreground"
          style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}
        >
          Amount
        </p>
        <div
          className={[
            'flex items-center rounded-xl border bg-background overflow-hidden focus-within:ring-2 transition-all',
            validationError
              ? 'border-destructive focus-within:ring-destructive/20'
              : 'border-border focus-within:border-foreground/40 focus-within:ring-foreground/10',
          ].join(' ')}
        >
          <span className="pl-4 text-muted-foreground" style={{ fontSize: '16px', fontWeight: 500 }}>$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountChange}
            className="flex-1 px-2 py-3.5 bg-transparent outline-none tabular-nums placeholder:text-muted-foreground/40"
            style={{ fontSize: '18px', fontWeight: 500 }}
          />
          <span className="pr-4 text-muted-foreground" style={{ fontSize: '12px', fontWeight: 500 }}>USD</span>
        </div>
        <AnimatePresence>
          {validationError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-2 px-1">
                <AlertCircle className="size-3.5 text-destructive shrink-0" />
                <p className="text-destructive" style={{ fontSize: '12px' }}>{validationError}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <CostBreakdown
              fromPlatform={fromWallet.platform}
              toPlatform={toWallet.platform}
              amount={numAmount}
              spread={activeRate!.spread}
              rate={activeRate!.rate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={[
          'w-full flex items-center justify-center gap-2 h-12 rounded-xl transition-all',
          canSubmit
            ? 'bg-primary text-primary-foreground hover:opacity-90'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        ].join(' ')}
        style={{ fontWeight: 500 }}
      >
        <ShieldCheck className="size-4" />
        Continue to Verify
      </button>
    </div>
  );
}
