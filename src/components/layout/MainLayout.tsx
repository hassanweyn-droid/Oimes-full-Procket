// ─────────────────────────────────────────────────────────────────────────────
// OIMES — MainLayout
// Composition shell: assembles Sidebar, Header, BottomNav, and NotificationPanel.
// Nav state is lifted to App.tsx so the parent can swap feature views.
// Display name is sourced from authStore so it reflects the signed-in user.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Receipt,
  Settings2,
} from 'lucide-react';
import { useOIMESStore, selectUnreadCount } from '../../store/index';
import { useAuthStore, selectCurrentUser } from '../../features/auth/auth-store';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { NotificationPanel } from './NotificationPanel';

// ─── Navigation Registry ───────────────────────────────────────────────────────

export const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'exchange',     label: 'Exchange',      icon: ArrowLeftRight  },
  { id: 'wallets',      label: 'Wallets',       icon: Wallet          },
  { id: 'transactions', label: 'Transactions',  icon: Receipt         },
  { id: 'settings',     label: 'Profile',       icon: Settings2       },
] as const;

export type NavItemId = (typeof NAV_ITEMS)[number]['id'];

// ─── MainLayout ────────────────────────────────────────────────────────────────

interface MainLayoutProps {
  activeNav: NavItemId;
  onNavChange: (nav: NavItemId) => void;
  children?: React.ReactNode;
}

export function MainLayout({ activeNav, onNavChange, children }: MainLayoutProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount  = useOIMESStore(selectUnreadCount);
  const currentUser  = useAuthStore(selectCurrentUser);
  const displayName  = currentUser?.displayName ?? 'User';
  const openNotif    = useCallback(() => setNotifOpen(true), []);
  const closeNotif   = useCallback(() => setNotifOpen(false), []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar active={activeNav} onNav={onNavChange} />
      <Header
        active={activeNav}
        unreadCount={unreadCount}
        displayName={displayName}
        onBell={openNotif}
      />
      <main className="md:pl-60 pt-[60px] pb-14 md:pb-0 min-h-screen" id="main-content">
        <div className="px-5 py-6 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
      <BottomNav active={activeNav} onNav={onNavChange} />
      <NotificationPanel open={notifOpen} onClose={closeNotif} />
    </div>
  );
}
