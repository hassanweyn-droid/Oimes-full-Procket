// ─────────────────────────────────────────────────────────────────────────────
// OIMES — AuthShell
// Wraps LoginView and SignupView with a shared animated container.
// Switching between pages animates via AnimatePresence.
//
// Both panels use the shared CSS variable design system (var(--background),
// var(--foreground), var(--card), etc.) instead of fixed colors, so this
// screen respects the Light / Dark / Aqua theme choice exactly like every
// other screen in the app.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LoginView } from './LoginView';
import { SignupView } from './SignupView';
import { ForgotPasswordView } from './ForgotPasswordView';
import { AppLogo } from '../../components/AppLogo';

type AuthPage = 'login' | 'signup' | 'forgot';

export function AuthShell() {
  const [page, setPage] = useState<AuthPage>('login');

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ background: 'var(--background)' }}
    >
      {/* Left panel — brand illustration (desktop only) */}
      <div
        className="hidden md:flex md:w-[44%] flex-col justify-between p-10"
        style={{
          background: 'var(--card)',
          borderRight: '1px solid var(--border)',
          minHeight: '100vh',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <AppLogo size={38} />
          <span style={{ color: 'var(--foreground)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>
            OIMES
          </span>
        </div>

        {/* Center copy */}
        <div>
          <h2
            style={{
              color: 'var(--foreground)',
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              marginBottom: 16,
            }}
          >
            Move money between<br />Somali platforms<br />instantly.
          </h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.7, maxWidth: 300 }}>
            Exchange between EVC Plus, Zaad, Sahal, and eDahab with real-time rates and low gateway fees.
          </p>

          {/* Platform badges */}
          <div className="flex flex-wrap gap-2 mt-6">
            {['EVC Plus', 'Zaad', 'Sahal', 'eDahab'].map((name) => (
              <span
                key={name}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="flex flex-col gap-1.5">
          <p style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>
            © 2026 OIMES · Somali Mobile Money Exchange
          </p>
          <a
            href="/admin"
            style={{ color: 'var(--muted-foreground)', fontSize: 11, textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            Admin portal →
          </a>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div
        className="flex flex-col flex-1 overflow-y-auto"
        style={{
          background: 'var(--background)',
          color: 'var(--foreground)',
          minHeight: '100vh',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {page === 'login' ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col flex-1"
            >
              <LoginView onGoToSignup={() => setPage('signup')} onForgotPassword={() => setPage('forgot')} />
            </motion.div>
          ) : page === 'signup' ? (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col flex-1"
            >
              <SignupView onGoToLogin={() => setPage('login')} />
            </motion.div>
          ) : (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col flex-1"
            >
              <ForgotPasswordView onBackToLogin={() => setPage('login')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
