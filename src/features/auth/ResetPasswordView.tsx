// ─────────────────────────────────────────────────────────────────────────────
// OIMES — ResetPasswordView
// Lands here from the email link Supabase sends via resetPasswordForEmail.
// Supabase's client automatically detects the recovery token in the URL and
// establishes a temporary session — we just need to call updateUser with the
// new password while that session is active.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AppLogo } from '../../components/AppLogo';

export function ResetPasswordView() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Supabase parses the recovery token from the URL fragment on load and
    // fires this event once the temporary session is ready.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // If the session was already established by the time this mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
      setError('Password must be 8+ characters with letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
      setTimeout(() => { window.location.href = '/'; }, 2000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-[380px]">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 38, height: 38, background: 'var(--primary)' }}>
              <AppLogo size={24} color="var(--primary-foreground)" />
        </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center text-center" style={{ paddingTop: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--status-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <CheckCircle2 size={26} style={{ color: 'var(--status-success-fg)' }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Password updated</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Taking you back to sign in…</p>
          </div>
        ) : !ready ? (
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
            Verifying your reset link… If this doesn't update in a few seconds, the link may have expired — request a new one from the sign-in page.
          </p>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>Set a new password</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 24 }}>Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {error && (
                <div style={{ background: 'var(--error-banner-bg)', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--destructive)' }}>
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>New password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="8+ characters, letters & numbers"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', paddingLeft: 36, paddingRight: 40, paddingTop: 10, paddingBottom: 10, fontSize: 14, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--input-background)', color: 'var(--foreground)', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowPassword((p) => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 4 }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Confirm new password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--input-background)', color: 'var(--foreground)', outline: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 11, paddingBottom: 11, borderRadius: 8, background: loading ? 'var(--muted)' : 'var(--primary)', color: 'var(--primary-foreground)', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}
              >
                {loading ? (<><Loader2 size={15} className="animate-spin" /> Updating…</>) : (<>Update password <ArrowRight size={15} /></>)}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
