// ─────────────────────────────────────────────────────────────────────────────
// OIMES — ExchangeView
// Multi-step stage orchestrator: Form → OTP Verification → Processing → Success.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeftRight,
  Check,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  useOIMESStore,
  selectWallets,
  selectExchangeRates,
  OIMESExchangeError,
  PLATFORM_METADATA,
} from '../../store/index';
import { formatUSD, round2 } from '../../lib/utils';
import { FormStage } from './FormStage';
import { OtpInput } from './OtpInput';
import type { ExchangeResult } from '../../types';

// ─── Stage type ───────────────────────────────────────────────────────────────

type Stage = 'form' | 'otp' | 'processing' | 'success';

const STAGE_VARIANTS = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.16 } },
};

// ─── ExchangeView ─────────────────────────────────────────────────────────────

export function ExchangeView() {
  const wallets         = useOIMESStore(selectWallets);
  const rates           = useOIMESStore(selectExchangeRates);
  const executeExchange = useOIMESStore((s) => s.executeExchange);

  const [stage,     setStage]     = useState<Stage>('form');
  const [simOtp,    setSimOtp]    = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [otpError,  setOtpError]  = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [result,    setResult]    = useState<ExchangeResult | null>(null);

  // Capture form selections to pass through OTP → processing
  const fromIdRef = useRef(wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? '');
  const toIdRef   = useRef(wallets.find((w) => w.id !== fromIdRef.current)?.id ?? wallets[1]?.id ?? '');
  const amountRef = useRef(0);

  const handleFormContinue = useCallback((otp: string, fromId: string, toId: string, amount: number) => {
    setSimOtp(otp);
    fromIdRef.current  = fromId;
    toIdRef.current    = toId;
    amountRef.current  = amount;
    setOtpDigits(Array(6).fill(''));
    setOtpError(false);
    setStage('otp');
  }, []);

  const handleVerify = useCallback(async () => {
    const entered = otpDigits.join('');
    if (entered !== simOtp) { setOtpError(true); return; }
    setOtpError(false);
    setStage('processing');

    await new Promise((r) => setTimeout(r, 1400));

    try {
      const fromWallet = wallets.find((w) => w.id === fromIdRef.current)!;
      const toWallet   = wallets.find((w) => w.id === toIdRef.current)!;
      const res = await executeExchange({
        fromWalletId: fromIdRef.current,
        toWalletId:   toIdRef.current,
        fromAmount:   amountRef.current,
        description:  `Exchange from ${PLATFORM_METADATA[fromWallet.platform].displayName} to ${PLATFORM_METADATA[toWallet.platform].displayName}`,
      });
      setResult(res);
      setStage('success');
    } catch (e) {
      const msg = e instanceof OIMESExchangeError ? e.message : 'Exchange failed. Please try again.';
      setExecError(msg);
      setStage('form');
    }
  }, [otpDigits, simOtp, executeExchange, wallets]);

  const handleReset = useCallback(() => {
    setStage('form');
    setOtpDigits(Array(6).fill(''));
    setSimOtp('');
    setOtpError(false);
    setExecError(null);
    setResult(null);
  }, []);

  const fromWallet = wallets.find((w) => w.id === fromIdRef.current);
  const toWallet   = wallets.find((w) => w.id === toIdRef.current);
  const activeRate = useMemo(
    () =>
      fromWallet && toWallet
        ? rates.find((r) => r.fromPlatform === fromWallet.platform && r.toPlatform === toWallet.platform)
        : undefined,
    [rates, fromWallet, toWallet]
  );

  const otpCode = otpDigits.join('');

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-foreground">Exchange</h1>
        <p className="mt-1 text-muted-foreground" style={{ fontSize: '13px' }}>
          Send funds between your mobile money wallets instantly.
        </p>
      </div>

      <AnimatePresence>
        {execError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5">
              <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--destructive)' }}>Exchange failed</p>
                <p style={{ fontSize: '12px' }} className="text-muted-foreground mt-0.5">{execError}</p>
              </div>
              <button onClick={() => setExecError(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <AnimatePresence mode="wait">

          {stage === 'form' && (
            <motion.div key="form" {...STAGE_VARIANTS} className="p-6">
              <FormStage onContinue={handleFormContinue} />
            </motion.div>
          )}

          {stage === 'otp' && (
            <motion.div key="otp" {...STAGE_VARIANTS} className="p-6 space-y-6">
              <button
                onClick={() => setStage('form')}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontSize: '13px' }}
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>

              <div className="text-center space-y-1">
                <div className="flex items-center justify-center size-12 rounded-full bg-accent mx-auto mb-3">
                  <ShieldCheck className="size-6 text-foreground" />
                </div>
                <h2 className="text-foreground">Verify Transaction</h2>
                {fromWallet && (
                  <p className="text-muted-foreground" style={{ fontSize: '13px' }}>
                    OTP sent to{' '}
                    <span className="text-foreground" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      {fromWallet.phoneNumber}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <OtpInput value={otpDigits} onChange={setOtpDigits} hasError={otpError} />
                <AnimatePresence>
                  {otpError && (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-center text-destructive"
                      style={{ fontSize: '12px' }}
                    >
                      Incorrect code — please try again.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="size-3.5 text-amber-600 shrink-0" />
                <p style={{ fontSize: '11px', color: 'var(--status-warning-fg)' }}>
                  Simulation mode — enter{' '}
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.12em' }}>
                    {simOtp}
                  </span>
                </p>
              </div>

              {fromWallet && toWallet && activeRate && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground" style={{ fontSize: '12px' }}>
                  <div className="size-1.5 rounded-full" style={{ backgroundColor: PLATFORM_METADATA[fromWallet.platform].brandColor }} />
                  <span>{formatUSD(amountRef.current)} from {PLATFORM_METADATA[fromWallet.platform].shortCode}</span>
                  <ArrowLeftRight className="size-3" />
                  <span className="text-emerald-600">
                    {formatUSD(round2((amountRef.current - round2(amountRef.current * activeRate.spread)) * activeRate.rate))} to {PLATFORM_METADATA[toWallet.platform].shortCode}
                  </span>
                  <div className="size-1.5 rounded-full" style={{ backgroundColor: PLATFORM_METADATA[toWallet.platform].brandColor }} />
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={otpCode.length !== 6}
                className={[
                  'w-full h-12 rounded-xl flex items-center justify-center gap-2 transition-all',
                  otpCode.length === 6
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                ].join(' ')}
                style={{ fontWeight: 500 }}
              >
                Verify & Send {fromWallet ? formatUSD(amountRef.current) : ''}
              </button>
            </motion.div>
          )}

          {stage === 'processing' && (
            <motion.div key="processing" {...STAGE_VARIANTS} className="p-12 flex flex-col items-center gap-5 text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Loader2 className="size-10 text-foreground" />
              </motion.div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 500 }}>Processing exchange…</p>
                {fromWallet && toWallet && (
                  <p className="mt-1 text-muted-foreground" style={{ fontSize: '13px' }}>
                    {PLATFORM_METADATA[fromWallet.platform].displayName} → {PLATFORM_METADATA[toWallet.platform].displayName}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {stage === 'success' && result && (
            <motion.div key="success" {...STAGE_VARIANTS} className="p-6 flex flex-col items-center gap-5 text-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.05 }}
                className="flex items-center justify-center size-16 rounded-full"
                style={{ backgroundColor: 'var(--status-success-fg)' }}
              >
                <Check className="size-8 text-white" strokeWidth={2.5} />
              </motion.div>

              <div className="space-y-1">
                <h2 className="text-foreground">Exchange Successful</h2>
                <p className="text-muted-foreground" style={{ fontSize: '13px' }}>Funds have been transferred instantly.</p>
              </div>

              <div className="w-full rounded-xl border border-border bg-accent/20 divide-y divide-border">
                {[
                  { label: 'You sent',     value: formatUSD(result.transaction.fromAmount.amount), color: 'var(--foreground)' },
                  { label: 'Gateway fee',  value: `− ${formatUSD(result.fee.total.amount)}`, color: 'var(--destructive)' },
                  { label: 'You received', value: formatUSD(result.receivedAmount.amount), color: 'var(--status-success-fg)' },
                  { label: 'Reference',    value: result.transaction.reference.split('-').slice(-2).join('-'), mono: true, color: 'var(--muted-foreground)' },
                ].map(({ label, value, color, mono }) => (
                  <div key={label} className="flex justify-between items-baseline px-4 py-2.5">
                    <span className="text-muted-foreground" style={{ fontSize: '12px' }}>{label}</span>
                    <span
                      className="tabular-nums"
                      style={{ fontSize: mono ? '11px' : '13px', fontWeight: 500, color, fontFamily: mono ? 'ui-monospace, monospace' : undefined }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleReset}
                className="flex items-center gap-2 h-11 px-6 rounded-xl border border-border hover:bg-accent transition-colors"
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                <RotateCcw className="size-3.5" />
                New Exchange
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
