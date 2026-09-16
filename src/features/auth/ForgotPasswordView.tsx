// ─────────────────────────────────────────────────────────────────────────────
// OIMES — ForgotPasswordView
// Sends a Supabase password reset email. The link in that email lands the
// person back on /reset-password (see ResetPasswordView.tsx), where they set
// a new password.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordView({ onBackToLogin }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address');
      emailRef.current?.focus();
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-1.5"
          style={{ background: 'none', border: 'none', padding: 0, marginBottom: 20, fontSize: 13, color: 'var(--muted-foreground)', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>

        {sent ? (
          <div className="flex flex-col items-center text-center" style={{ paddingTop: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--status-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <CheckCircle2 size={26} style={{ color: 'var(--status-success-fg)' }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Check your email</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2, marginBottom: 6 }}>
              Reset your password
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 24 }}>
              Enter your email and we'll send you a link to reset it.
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {error && (
                <div style={{ background: 'var(--error-banner-bg)', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--destructive)' }}>
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                  <input
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    placeholder="hassan@oimes.so"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    style={{
                      width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                      fontSize: 14, borderRadius: 8, border: '1.5px solid var(--border)',
                      background: 'var(--input-background)', color: 'var(--foreground)', outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  paddingTop: 11, paddingBottom: 11, borderRadius: 8,
                  background: loading ? 'var(--muted)' : 'var(--primary)', color: 'var(--primary-foreground)',
                  fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, marginTop: 4,
                }}
              >
                {loading ? (<><Loader2 size={15} className="animate-spin" /> Sending…</>) : (<>Send reset link <ArrowRight size={15} /></>)}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
