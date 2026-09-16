// ─────────────────────────────────────────────────────────────────────────────
// OIMES — AdminLoginView
// Username + password login for the admin portal. Uses the exact same design
// system (CSS variables, type scale, spacing, copy patterns) as the customer
// LoginView so the two feel like one product — the only visual difference is
// a small "Admin" tag on the brand mark, so it's still obvious which portal
// you're in.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAdminAuthStore, AdminAuthError } from './admin-store';
import { AppLogo } from '../../components/AppLogo';

export function AdminLoginView() {
  const login = useAdminAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function validate(): boolean {
    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) errors.username = 'Email is required';
    if (!password) errors.password = 'Password is required';
    setFieldErrors(errors);
    if (errors.username) usernameRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!validate()) return;

    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err instanceof AdminAuthError) setErrorMsg(err.message);
      else setErrorMsg('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 40, height: 40, background: 'var(--primary)' }}
          >
            <AppLogo size={24} color="var(--primary-foreground)" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)' }}>OIMES</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--primary)',
                  background: 'var(--accent)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                ADMIN
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Internal control panel</p>
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2, marginBottom: 6 }}>
          Admin sign in
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 24 }}>
          Private, invite-only access — separate from customer accounts.
        </p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: 'var(--error-banner-bg)',
                  border: '1px solid #FCA5A5',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'var(--destructive)',
                }}
              >
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Email address</label>
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--muted-foreground)' }}
              />
              <input
                ref={usernameRef}
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFieldErrors((p) => ({ ...p, username: undefined }));
                  setErrorMsg('');
                }}
                style={inputStyle(!!fieldErrors.username)}
                onFocus={(e) => (e.target.style.borderColor = fieldErrors.username ? 'var(--destructive)' : 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = fieldErrors.username ? 'var(--error-banner-border)' : 'var(--border)')}
              />
            </div>
            {fieldErrors.username && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.username}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Password</label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--muted-foreground)' }}
              />
              <input
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                  setErrorMsg('');
                }}
                style={{ ...inputStyle(!!fieldErrors.password), paddingRight: 40 }}
                onFocus={(e) => (e.target.style.borderColor = fieldErrors.password ? 'var(--destructive)' : 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = fieldErrors.password ? 'var(--error-banner-border)' : 'var(--border)')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                  display: 'flex',
                  padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {fieldErrors.password && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.password}</span>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingTop: 11,
              paddingBottom: 11,
              borderRadius: 8,
              background: loading ? 'var(--muted)' : 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, opacity 0.15s',
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    paddingLeft: 36,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    borderRadius: 8,
    border: `1.5px solid ${hasError ? 'var(--error-banner-border)' : 'var(--border)'}`,
    background: 'var(--input-background)',
    color: 'var(--foreground)',
    outline: 'none',
  };
}
