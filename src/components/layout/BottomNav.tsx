// ─────────────────────────────────────────────────────────────────────────────
// OIMES — BottomNav
// Mobile-only bottom navigation bar.
// ─────────────────────────────────────────────────────────────────────────────

import { NAV_ITEMS } from './MainLayout';
import type { NavItemId } from './MainLayout';

interface BottomNavProps {
  active: NavItemId;
  onNav: (id: NavItemId) => void;
}

export function BottomNav({ active, onNav }: BottomNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex bg-background border-t border-border"
      aria-label="Mobile navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px]',
              'transition-colors duration-100',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            ].join(' ')}
          >
            <item.icon className="size-5 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
            <span style={{ fontSize: '10px', fontWeight: isActive ? 500 : 400 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
