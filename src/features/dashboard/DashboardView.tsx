// ─────────────────────────────────────────────────────────────────────────────
// OIMES — DashboardView
// Assembles the customer's dashboard cards.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from 'motion/react';
import { useAuthStore, selectCurrentUser } from '../../features/auth/auth-store';
import { BalanceCard }        from './BalanceCard';
import { DailyLimitCard }     from './DailyLimitCard';
import { RatesGrid }          from './RatesGrid';
import { RecentTransactions } from './RecentTransactions';

export const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 14 },
  visible: (delay: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardView() {
  const currentUser = useAuthStore(selectCurrentUser);
  const firstName   = currentUser?.firstName ?? 'there';

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-foreground">{getGreeting()}, {firstName}</h1>
        <p className="mt-1 text-muted-foreground" style={{ fontSize: 13 }}>
          Here's your financial overview. All amounts in USD.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BalanceCard />
        <DailyLimitCard />
      </div>

      <RatesGrid />
      <RecentTransactions />
    </div>
  );
}
