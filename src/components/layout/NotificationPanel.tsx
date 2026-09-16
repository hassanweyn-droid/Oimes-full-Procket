// ─────────────────────────────────────────────────────────────────────────────
// OIMES — NotificationPanel
// Slide-in panel with notification list, mark-all, and dismiss actions.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Bell,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useOIMESStore,
  selectNotifications,
  selectUnreadCount,
} from '../../store/index';
import type { Notification, NotificationType } from '../../types';

// ─── NotifIcon ────────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: NotificationType }) {
  const cls = 'size-4 shrink-0';
  switch (type) {
    case 'success': return <CheckCircle2 className={`${cls} text-emerald-500`} />;
    case 'error':   return <XCircle      className={`${cls} text-destructive`} />;
    case 'warning': return <AlertTriangle className={`${cls} text-amber-500`} />;
    case 'info':    return <Info          className={`${cls} text-blue-500`} />;
  }
}

// ─── NotificationRow ──────────────────────────────────────────────────────────

interface NotificationRowProps {
  n: Notification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function NotificationRow({ n, onRead, onDismiss }: NotificationRowProps) {
  const ago = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
      onClick={() => { if (!n.isRead) onRead(n.id); }}
      className={[
        'group relative flex gap-3 px-5 py-4 cursor-pointer',
        'border-b border-border last:border-b-0',
        'transition-colors duration-100',
        n.isRead ? 'bg-background' : 'bg-secondary/50',
        'hover:bg-accent',
      ].join(' ')}
    >
      {!n.isRead && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-primary" />
      )}
      <div className="mt-0.5"><NotifIcon type={n.type} /></div>
      <div className="flex-1 min-w-0">
        <p className={n.isRead ? 'text-foreground/60' : 'text-foreground'}>{n.title}</p>
        <p
          className="mt-0.5 text-muted-foreground overflow-hidden"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
        >
          {n.message}
        </p>
        <p className="mt-1.5" style={{ fontSize: '11px', color: 'var(--muted-foreground)', opacity: 0.7 }}>
          {ago}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
        aria-label="Dismiss"
        className={[
          'shrink-0 self-start -mr-1 mt-0.5',
          'flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'text-muted-foreground hover:text-foreground hover:bg-accent/80',
        ].join(' ')}
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

// ─── NotificationPanel ────────────────────────────────────────────────────────

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const notifications = useOIMESStore(selectNotifications);
  const unreadCount   = useOIMESStore(selectUnreadCount);
  const markRead      = useOIMESStore((s) => s.markNotificationRead);
  const markAll       = useOIMESStore((s) => s.markAllNotificationsRead);
  const dismiss       = useOIMESStore((s) => s.dismissNotification);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20"
            style={{ backdropFilter: 'blur(1px)' }}
          />
          <motion.aside
            key="notif-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            className="fixed top-0 right-0 z-50 flex flex-col h-full w-full sm:w-[400px] bg-background border-l border-border shadow-2xl"
            aria-modal="true" role="dialog" aria-label="Notifications"
          >
            <div className="flex items-center justify-between px-5 h-[60px] border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <h2>Notifications</h2>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0.7 }} animate={{ scale: 1 }}
                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground tabular-nums"
                    style={{ fontSize: '11px', fontWeight: 600 }}
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAll}
                    className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <CheckCheck className="size-3.5" />
                    <span style={{ fontSize: '13px' }}>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={onClose} aria-label="Close"
                  className="flex items-center justify-center size-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
                  <div className="flex items-center justify-center size-12 rounded-full bg-accent">
                    <Bell className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p>All caught up</p>
                    <p className="mt-1 text-muted-foreground">No notifications to show.</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((n) => (
                    <NotificationRow key={n.id} n={n} onRead={markRead} onDismiss={dismiss} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
