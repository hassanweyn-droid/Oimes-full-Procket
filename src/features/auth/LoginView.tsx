// ─────────────────────────────────────────────────────────────────────────────
// OIMES — LoginView
// Email + password login form with validation and animated error feedback.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from './auth-store';
import { AuthError } from './auth-store';
import { AppLogo } from '../../components/AppLogo';

interface LoginViewProps {
  onGoToSignup: () => void;
  onForgotPassword: () => void;
}

export function LoginView({ onGoToSignup, onForgotPassword }: LoginViewProps) {
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
    if (!password) errors.password = 'Password is required';
    setFieldErrors(errors);
    if (errors.email) emailRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!validate()) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
      // on success, App.tsx will re-render with authenticated view
    } catch (err) {
      if (err instanceof AuthError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 justify-center px-6 py-10 max-w-[400px] mx-auto w-full">
      {/* Brand mark */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: 'var(--primary)' }}>
            <AppLogo size={24} color="var(--primary-foreground)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--foreground)' }}>OIMES</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>
          Welcome back
        </h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--muted-foreground)' }}>
          Sign in to your mobile money exchange account.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        {/* Global error */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              key="err"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
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

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-email"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}
          >
            Email address
          </label>
          <div className="relative">
            <Mail
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              id="login-email"
              ref={emailRef}
              type="email"
              autoComplete="email"
              placeholder="ENTER YOUR EMAIL"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); setErrorMsg(''); }}
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 12,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
                borderRadius: 8,
                border: `1.5px solid ${fieldErrors.email ? 'var(--error-banner-border)' : 'var(--border)'}`,
                background: 'var(--input-background)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = fieldErrors.email ? 'var(--destructive)' : 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = fieldErrors.email ? 'var(--error-banner-border)' : 'var(--border)')}
            />
          </div>
          {fieldErrors.email && (
            <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.email}</span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-password"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}
          >
            Password
          </label>
          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              id="login-password"
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); setErrorMsg(''); }}
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 40,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
                borderRadius: 8,
                border: `1.5px solid ${fieldErrors.password ? 'var(--error-banner-border)' : 'var(--border)'}`,
                background: 'var(--input-background)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
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
                alignItems: 'center',
                padding: 4,
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {fieldErrors.password && (
            <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{fieldErrors.password}</span>
          )}
          <button
            type="button"
            onClick={onForgotPassword}
            style={{ alignSelf: 'flex-end', background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: 'var(--muted-foreground)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Forgot password?
          </button>
        </div>

        {/* Submit */}
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
          }}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </motion.form>

      {/* Footer link */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ marginTop: 28, textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}
      >
        New to OIMES?{' '}
        <button
          type="button"
          onClick={onGoToSignup}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--foreground)',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Create an account
        </button>
      </motion.p>
    </div>
  );
}
