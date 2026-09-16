// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Sidebar
// ─────────────────────────────────────────────────────────────────────────────

import { LogOut } from 'lucide-react';
import { NAV_ITEMS } from './MainLayout';
import type { NavItemId } from './MainLayout';
import { useAuthStore } from '../../features/auth/auth-store';
import { AppLogo } from '../AppLogo';

interface SidebarProps {
  active: NavItemId;
  onNav: (id: NavItemId) => void;
}

export function Sidebar({ active, onNav }: SidebarProps) {
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-30 w-60 bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 h-[60px] border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-center size-7 rounded-md bg-primary shrink-0">
          <AppLogo size={20} color="var(--primary-foreground)" />
        </div>
        <span className="tracking-tight text-sidebar-foreground" style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
          OIMES
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <button onClick={() => onNav(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'w-full flex items-center gap-3 px-3 rounded-md min-h-[44px]',
                    'transition-colors duration-100 text-left',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  ].join(' ')}>
                  <item.icon className="size-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="shrink-0 px-3 py-4 border-t border-sidebar-border">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-100">
          <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
