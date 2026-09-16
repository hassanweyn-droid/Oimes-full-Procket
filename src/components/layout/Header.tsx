// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Header
// Fixed top bar: bell, user avatar (photo or initials), logout dropdown.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, LogOut } from 'lucide-react';
import { getInitials, getAvatarColor } from '../../lib/utils';
import { NAV_ITEMS } from './MainLayout';
import type { NavItemId } from './MainLayout';
import { useAuthStore, selectCurrentUser } from '../../features/auth/auth-store';

interface HeaderProps {
  active: NavItemId;
  unreadCount: number;
  displayName: string;
  onBell: () => void;
}

export function Header({ active, unreadCount, displayName, onBell }: HeaderProps) {
  const label        = NAV_ITEMS.find((n) => n.id === active)?.label ?? '';
  const initials     = getInitials(displayName);
  const currentUser  = useAuthStore(selectCurrentUser);
  const avatarColor  = getAvatarColor(currentUser?.id ?? displayName);
  const logout       = useAuthStore((s) => s.logout);
  const avatarDataUrl = currentUser?.avatarUrl;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 md:left-60 z-20 h-[60px] flex items-center justify-between px-5 bg-background border-b border-border">
      <h3 className="text-foreground">{label}</h3>
      <div className="flex items-center gap-1">

        {/* Bell */}
        <button onClick={onBell}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          className="relative flex items-center justify-center size-[44px] rounded-md text-foreground/60 hover:text-foreground hover:bg-accent transition-colors">
          <Bell className="size-[18px]" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span key="badge"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-[9px] right-[9px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground tabular-nums"
                style={{ minWidth: '16px', height: '16px', fontSize: '10px', fontWeight: 600, padding: '0 3px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Avatar + dropdown */}
        <div className="relative">
          <button onClick={() => setMenuOpen((p) => !p)} aria-label="User menu"
            className="flex items-center gap-2.5 px-3 min-h-[44px] rounded-md hover:bg-accent transition-colors select-none">
            <div className="size-7 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: avatarDataUrl ? undefined : avatarColor }}>
              {avatarDataUrl
                ? <img src={avatarDataUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>{initials}</span>
              }
            </div>
            <span className="hidden sm:block text-foreground">{displayName}</span>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <motion.div key="user-menu"
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    minWidth: 180, zIndex: 40, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{displayName}</p>
                  </div>
                  <button onClick={() => { setMenuOpen(false); logout(); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: 'var(--destructive)', fontWeight: 500, textAlign: 'left' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--error-banner-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                    <LogOut size={14} />Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
