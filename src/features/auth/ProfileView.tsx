// ─────────────────────────────────────────────────────────────────────────────
// OIMES — ProfileView
// Each section (Personal Info, Wallets, Language, Theme, KYC, Security,
// Change Password, Notifications, Help & Support) is a dedicated full-screen
// page reached by tapping a menu row — not a tab bar, not stacked cards.
// Matches the native-app reference design: avatar hero + vertical menu list.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, Phone, MapPin, CalendarDays, ShieldCheck, ShieldAlert, BadgeCheck,
  LogOut, Sun, Moon, Droplets, Globe, Camera, Trash2, Lock, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, ChevronLeft, ChevronRight, Wallet,
  Bell, HelpCircle, Plus, Send, Smartphone,
} from 'lucide-react';
import { useAuthStore, selectCurrentUser, AuthError } from './auth-store';
import { supabase } from '../../lib/supabase';
import { useSettingsStore, applyTheme, STRINGS } from './settings-store';
import type { Theme, Language, SecuritySettings, NotificationSettings } from './settings-store';
import { useSupportChat } from './use-support-chat';
import { useOIMESStore, selectWallets, PLATFORM_METADATA, OIMESExchangeError } from '../../store/index';
import { PlatformLogo } from '../../components/PlatformLogo';
import type { MobileMoneyPlatform } from '../../types';
import { getInitials, getAvatarColor, formatUSD } from '../../lib/utils';

type T = { [K in keyof typeof STRINGS['en']]: string };

// ─── Page registry ─────────────────────────────────────────────────────────────

type Page =
  | 'main' | 'personal' | 'accounts' | 'language' | 'theme'
  | 'kyc' | 'security' | 'password' | 'notifications' | 'help';

// ─── Shared full-screen shell ──────────────────────────────────────────────────

function SubScreen({
  title, onBack, children,
}: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
            background: 'var(--card)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: 'var(--foreground)', flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

// ─── KYC badge ────────────────────────────────────────────────────────────────

function KycBadge({ status, t }: { status: string; t: T }) {
  const cfg =
    status === 'verified'
      ? { bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)', border: '#6EE7B7', label: t.verified, Icon: ShieldCheck }
      : status === 'pending'
      ? { bg: 'var(--status-warning-bg)', fg: 'var(--status-warning-fg)', border: 'var(--status-warning-fg)', label: t.pending, Icon: ShieldAlert }
      : { bg: 'var(--muted)', fg: 'var(--muted-foreground)', border: 'var(--border)', label: t.unverified, Icon: ShieldAlert };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
      borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.fg, fontSize: 12, fontWeight: 600 }}>
      <cfg.Icon size={12} />{cfg.label}
    </span>
  );
}

// ─── Field row (read-only info) ────────────────────────────────────────────────

function FieldRow({ icon: Icon, label, value, last }: {
  icon: React.ElementType; label: string; value: string; last?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 14.5, color: 'var(--foreground)', fontWeight: 500 }}>{value || '—'}</p>
      </div>
    </div>
  );
}

// ─── Toggle switch ──────────────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange, last }: {
  label: string; checked: boolean; onChange: () => void; last?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '15px 16px', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ fontSize: 14.5, color: 'var(--foreground)' }}>{label}</span>
      <button
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        style={{
          width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: checked ? '#22c55e' : 'var(--muted)', position: 'relative',
          transition: 'background 0.2s', flexShrink: 0, padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN MENU
// ═════════════════════════════════════════════════════════════════════════════

function MainMenu({
  t, onNav, logout,
}: { t: T; onNav: (p: Page) => void; logout: () => void }) {
  const user = useAuthStore(selectCurrentUser);
  const updateCurrentUserFields = useAuthStore((s) => s.updateCurrentUserFields);
  const { theme, language } = useSettingsStore();
  const wallets = useOIMESStore(selectWallets);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  if (!user) return null;
  const initials = getInitials(user.displayName);
  const avatarColor = getAvatarColor(user.id);
  const avatarDataUrl = user.avatarUrl;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024 || !file.type.startsWith('image/')) {
      setAvatarError('Choose an image under 2MB.');
      return;
    }
    setAvatarUploading(true);
    setAvatarError('');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      setAvatarUploading(false);
      setAvatarError('Could not upload photo. Please try again.');
      return;
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const cacheBustedUrl = `${pub.publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase.from('users').update({ avatar_url: cacheBustedUrl }).eq('id', user.id);
    setAvatarUploading(false);
    if (updateError) {
      setAvatarError('Photo uploaded, but could not save it to your profile.');
      return;
    }
    updateCurrentUserFields({ avatarUrl: cacheBustedUrl });
  }

  const themeLabel = theme === 'light' ? t.themeLight : theme === 'dark' ? t.themeDark : t.themeAqua;
  const langLabel = language === 'en' ? t.langEn : t.langSo;

  const menuRows: { id: Page; icon: React.ElementType; label: string; right?: React.ReactNode }[] = [
    { id: 'personal',      icon: User,        label: t.personalInfo },
    { id: 'accounts',      icon: Wallet,      label: t.accounts, right: wallets.length > 0
        ? <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{wallets.length}</span> : undefined },
    { id: 'language',      icon: Globe,       label: t.language, right: <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{langLabel}</span> },
    { id: 'theme',         icon: Droplets,    label: t.appearance, right: <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{themeLabel}</span> },
    { id: 'kyc',           icon: BadgeCheck,  label: t.identity, right: <KycBadge status={user.kycStatus} t={t} /> },
    { id: 'security',      icon: ShieldCheck, label: t.security },
    { id: 'password',      icon: Lock,        label: t.changePassword },
    { id: 'notifications', icon: Bell,        label: t.notifications },
    { id: 'help',          icon: HelpCircle,  label: t.help },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-6">
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{
            width: 92, height: 92, borderRadius: '50%', overflow: 'hidden',
            background: avatarDataUrl ? undefined : avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {avatarDataUrl
              ? <img src={avatarDataUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontWeight: 700, fontSize: 30 }}>{initials}</span>}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Upload photo"
            disabled={avatarUploading}
            style={{
              position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: '50%',
              background: 'var(--foreground)', border: '3px solid var(--background)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: avatarUploading ? 'wait' : 'pointer',
            }}
          >
            <Camera size={13} style={{ color: 'var(--background)' }} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        {avatarUploading && <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Uploading…</p>}
        {avatarError && <p style={{ fontSize: 12, color: 'var(--destructive)' }}>{avatarError}</p>}
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)' }}>{user.displayName}</p>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>{user.phone}</p>
      </div>

      {/* Menu list */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        {menuRows.map((row, i) => (
          <button
            key={row.id}
            onClick={() => onNav(row.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              borderBottom: i === menuRows.length - 1 ? 'none' : '1px solid var(--border)',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <row.icon size={16} style={{ color: 'var(--muted-foreground)' }} />
            </div>
            <span style={{ flex: 1, fontSize: 14.5, color: 'var(--foreground)' }}>{row.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {row.right}
              <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
            </div>
          </button>
        ))}
      </div>

      {/* Sign out */}
      <button onClick={logout}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '13px 0', borderRadius: 14,
          background: 'var(--error-banner-bg)', border: '1px solid #FCA5A5', color: 'var(--destructive)',
          fontSize: 14.5, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--error-banner-bg)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--error-banner-bg)')}>
        <LogOut size={16} />{t.signOut}
      </button>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PERSONAL INFO
// ═════════════════════════════════════════════════════════════════════════════

function PersonalInfoPage({ t, onBack }: { t: T; onBack: () => void }) {
  const user = useAuthStore(selectCurrentUser);
  const { language } = useSettingsStore();
  if (!user) return null;
  const joined = new Date(user.createdAt).toLocaleDateString(
    language === 'so' ? 'so-SO' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }
  );
  return (
    <SubScreen title={t.personalInfo} onBack={onBack}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '2px 16px' }}>
        <FieldRow icon={User}         label={t.fullName}    value={user.displayName} />
        <FieldRow icon={Mail}         label={t.email}       value={user.email} />
        <FieldRow icon={Phone}        label={t.phone}       value={user.phone ?? ''} />
        <FieldRow icon={MapPin}       label={t.country}     value={user.address ? `${user.address.city}, ${user.address.region}, Somalia` : 'Somalia'} />
        <FieldRow icon={CalendarDays} label={t.memberSince} value={joined} last />
      </div>
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LINKED MOBILE WALLETS
// ═════════════════════════════════════════════════════════════════════════════

function AccountsPage({ t, onBack }: { t: T; onBack: () => void }) {
  const wallets      = useOIMESStore(selectWallets);
  const addWallet    = useOIMESStore((s) => s.addWallet);
  const removeWallet = useOIMESStore((s) => s.removeWallet);

  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState<MobileMoneyPlatform | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [removeError, setRemoveError] = useState('');

  const platforms: MobileMoneyPlatform[] = ['evc_plus', 'zaad', 'sahal', 'edahab'];

  async function handleAdd() {
    if (!provider) { setError(t.selectProviderFirst); return; }
    if (!phoneNumber.trim()) { setError(t.enterPhoneNumber); return; }
    try {
      await addWallet(provider, phoneNumber.trim());
      setShowAdd(false);
      setProvider(null);
      setPhoneNumber('');
      setError('');
    } catch (e) {
      setError(e instanceof OIMESExchangeError ? e.message : 'Could not link this wallet.');
    }
  }

  async function handleRemove(walletId: string) {
    try {
      await removeWallet(walletId);
      setRemoveError('');
    } catch (e) {
      setRemoveError(e instanceof OIMESExchangeError ? e.message : 'Could not remove this wallet.');
    }
  }

  return (
    <SubScreen title={t.accounts} onBack={onBack}>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 14 }}>{t.accountsSub}</p>

      {removeError && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 12,
          background: 'var(--error-banner-bg)', border: '1px solid #FECACA', marginBottom: 12 }}>
          <AlertCircle size={14} style={{ color: 'var(--destructive)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--destructive)' }}>{removeError}</p>
        </div>
      )}

      {wallets.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
          padding: '32px 20px', textAlign: 'center', marginBottom: 14 }}>
          <Smartphone size={28} style={{ color: 'var(--muted-foreground)', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{t.noAccounts}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
          {wallets.map((wallet, i) => {
            const meta = PLATFORM_METADATA[wallet.platform];
            return (
              <div key={wallet.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderBottom: i === wallets.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <PlatformLogo platform={wallet.platform} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{meta.displayName}</p>
                    {wallet.isDefault && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px',
                        borderRadius: 5, background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {wallet.phoneNumber} · {formatUSD(wallet.balance.amount)}
                  </p>
                </div>
                <button onClick={() => handleRemove(wallet.id)} aria-label="Remove account"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', padding: 6 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => { setShowAdd(true); setError(''); }}
        style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: '1.5px dashed var(--border-strong)',
          background: 'transparent', color: 'var(--foreground)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Plus size={16} />{t.addAccount}
      </button>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '20px 18px 28px',
                width: '100%', maxWidth: 480 }}
            >
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', textAlign: 'center', marginBottom: 16 }}>
                {t.chooseProvider}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {platforms.map((p) => {
                  const meta = PLATFORM_METADATA[p];
                  const selected = provider === p;
                  return (
                    <button key={p} onClick={() => setProvider(p)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                        fontSize: 13, fontWeight: 600, background: selected ? `${meta.brandColor}12` : 'var(--muted)',
                        border: `2px solid ${selected ? meta.brandColor : 'var(--border)'}`,
                        color: selected ? meta.brandColor : 'var(--muted-foreground)' }}>
                      <PlatformLogo platform={p} size={32} ring={!selected} />
                      {meta.displayName}
                    </button>
                  );
                })}
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={t.phoneNumberPh}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)',
                  background: 'var(--input-background)', color: 'var(--foreground)', fontSize: 14, outline: 'none', marginBottom: 10 }}
              />
              {error && <p style={{ fontSize: 12, color: 'var(--destructive)', marginBottom: 10 }}>{error}</p>}
              <button onClick={handleAdd}
                style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                  background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {t.addAccountBtn}
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ width: '100%', padding: '11px 0', marginTop: 6, borderRadius: 12, border: 'none',
                  background: 'transparent', color: 'var(--muted-foreground)', fontSize: 13, cursor: 'pointer' }}>
                {t.cancel}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SubScreen>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// LANGUAGE
// ═════════════════════════════════════════════════════════════════════════════

function LanguagePage({ t, onBack }: { t: T; onBack: () => void }) {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const options: { id: Language; label: string; flag: string }[] = [
    { id: 'en', label: t.langEn, flag: '🇬🇧' },
    { id: 'so', label: t.langSo, flag: '🇸🇴' },
  ];
  return (
    <SubScreen title={t.language} onBack={onBack}>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 14 }}>{t.languageSub}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {options.map(({ id, label, flag }) => {
          const active = language === id;
          return (
            <button key={id} onClick={() => setLanguage(id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '22px 14px', borderRadius: 16, cursor: 'pointer',
                border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary)' : 'var(--card)' }}>
              <span style={{ fontSize: 26 }}>{flag}</span>
              <span style={{ fontSize: 14, fontWeight: 600,
                color: active ? 'var(--primary-foreground)' : 'var(--foreground)' }}>{label}</span>
            </button>
          );
        })}
      </div>
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// THEME
// ═════════════════════════════════════════════════════════════════════════════

const THEME_OPTIONS: { id: Theme; key: 'themeLight' | 'themeDark' | 'themeAqua'; Icon: React.ElementType; accent: string }[] = [
  { id: 'light', key: 'themeLight', Icon: Sun,      accent: '#F59E0B' },
  { id: 'dark',  key: 'themeDark',  Icon: Moon,     accent: '#6366F1' },
  { id: 'aqua',  key: 'themeAqua',  Icon: Droplets, accent: '#0891B2' },
];

function ThemePage({ t, onBack }: { t: T; onBack: () => void }) {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  return (
    <SubScreen title={t.appearance} onBack={onBack}>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 14 }}>{t.appearanceSub}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {THEME_OPTIONS.map(({ id, key, Icon, accent }) => {
          const active = theme === id;
          return (
            <button key={id} onClick={() => { setTheme(id); applyTheme(id); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '20px 8px', borderRadius: 16, cursor: 'pointer',
                border: `2px solid ${active ? accent : 'var(--border)'}`,
                background: active ? `${accent}12` : 'var(--card)' }}>
              <Icon size={22} style={{ color: active ? accent : 'var(--muted-foreground)' }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? accent : 'var(--muted-foreground)' }}>
                {t[key]}
              </span>
            </button>
          );
        })}
      </div>
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// KYC
// ═════════════════════════════════════════════════════════════════════════════

function KycPage({ t, onBack }: { t: T; onBack: () => void }) {
  const user = useAuthStore(selectCurrentUser);
  const updateCurrentUserFields = useAuthStore((s) => s.updateCurrentUserFields);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [docRef, setDocRef] = useState('');

  if (!user) return null;
  const verified = user.kycStatus === 'verified';
  const canSubmit = user.kycStatus === 'unverified' || user.kycStatus === 'rejected';
  const pending = user.kycStatus === 'pending';

  async function handleSubmit() {
    if (!user) return;
    if (!docRef.trim()) {
      setError('Enter your national ID or passport number.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: updateError } = await supabase
      .from('users')
      .update({ kyc_status: 'pending', kyc_document_ref: docRef.trim() })
      .eq('id', user.id);
    if (updateError) {
      setError('Could not submit for verification. Please try again.');
    } else {
      updateCurrentUserFields({ kycStatus: 'pending' });
    }
    setSubmitting(false);
  }

  return (
    <SubScreen title={t.identity} onBack={onBack}>
      <div className="flex flex-col items-center text-center" style={{ padding: '20px 16px' }}>
        <div style={{
          width: 68, height: 68, borderRadius: '50%',
          background: verified ? 'var(--status-success-bg)' : 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          {verified
            ? <ShieldCheck size={28} style={{ color: 'var(--status-success-fg)' }} />
            : <ShieldAlert size={28} style={{ color: 'var(--muted-foreground)' }} />}
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
          {verified ? t.verified : t.unverified}
        </p>
      </div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '2px 16px' }}>
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
          <KycBadge status={user.kycStatus} t={t} />
        </div>
        <FieldRow icon={CalendarDays} label={t.memberSince} value={new Date(user.createdAt).toLocaleDateString()} last />
      </div>

      {canSubmit && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 10, textAlign: 'center' }}>
            Submit your account for identity verification. An admin will review it.
          </p>
          <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>
            National ID / passport number
          </label>
          <input
            type="text"
            value={docRef}
            onChange={(e) => setDocRef(e.target.value)}
            placeholder="e.g. SO1234567"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--input-background)', color: 'var(--foreground)', fontSize: 14, marginBottom: 10 }}
          />
          {error && <p style={{ fontSize: 12.5, color: 'var(--destructive)', textAlign: 'center', marginBottom: 8 }}>{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none',
              background: submitting ? 'var(--muted)' : 'var(--primary)',
              color: 'var(--primary-foreground)', fontSize: 14, fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </button>
        </div>
      )}

      {pending && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center' }}>
          Your verification is under review. This usually takes 1–2 business days.
        </p>
      )}
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY
// ═════════════════════════════════════════════════════════════════════════════

function SecurityPage({ t, onBack }: { t: T; onBack: () => void }) {
  const security = useSettingsStore((s) => s.security);
  const toggleSecurity = useSettingsStore((s) => s.toggleSecurity);
  const rows: { key: keyof SecuritySettings; label: string }[] = [
    { key: 'twoFactorEnabled',  label: t.twoFactor },
    { key: 'biometricEnabled',  label: t.biometric },
    { key: 'loginAlertsEnabled', label: t.loginAlerts },
  ];
  return (
    <SubScreen title={t.security} onBack={onBack}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <ToggleRow key={row.key} label={row.label} checked={security[row.key]}
            onChange={() => toggleSecurity(row.key)} last={i === rows.length - 1} />
        ))}
      </div>
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD
// ═════════════════════════════════════════════════════════════════════════════

function PasswordPage({ t, onBack }: { t: T; onBack: () => void }) {
  const changePw = useAuthStore((s) => s.changePassword);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(''); setSuccess(false);
    if (newPw.length < 8) { setErrorMsg(t.pwTooShort); return; }
    if (newPw !== confirmPw) { setErrorMsg(t.pwMismatch); return; }
    setLoading(true);
    try {
      await changePw(currentPw, newPw);
      setSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      if (err instanceof AuthError && err.code === 'WRONG_CURRENT_PASSWORD') setErrorMsg(t.wrongCurrentPw);
      else setErrorMsg('Something went wrong.');
    } finally { setLoading(false); }
  }

  const field = (id: string, label: string, val: string, setVal: (v: string) => void, show: boolean, setShow: (v: boolean) => void) => (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
        <input id={id} type={show ? 'text' : 'password'} value={val}
          onChange={(e) => { setVal(e.target.value); setErrorMsg(''); setSuccess(false); }}
          style={{ width: '100%', paddingLeft: 36, paddingRight: 40, paddingTop: 11, paddingBottom: 11,
            fontSize: 14, borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'var(--input-background)', color: 'var(--foreground)', outline: 'none' }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')} />
        <button type="button" onClick={() => setShow(!show)} aria-label="Toggle visibility"
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 4 }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <SubScreen title={t.changePassword} onBack={onBack}>
      <form onSubmit={handleSubmit} noValidate
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
        {field('cur-pw', t.currentPassword, currentPw, setCurrentPw, showCur, setShowCur)}
        {field('new-pw', t.newPassword, newPw, setNewPw, showNew, setShowNew)}
        {field('conf-pw', t.confirmPassword, confirmPw, setConfirmPw, showConf, setShowConf)}

        <AnimatePresence>
          {errorMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, padding: '10px 12px',
                borderRadius: 10, background: 'var(--error-banner-bg)', border: '1px solid #FCA5A5', color: 'var(--destructive)', fontSize: 13 }}>
              <AlertCircle size={14} />{errorMsg}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, padding: '10px 12px',
                borderRadius: 10, background: 'var(--status-success-bg)', border: '1px solid #6EE7B7', color: 'var(--status-success-fg)', fontSize: 13 }}>
              <CheckCircle2 size={14} />{t.passwordSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={loading || !currentPw || !newPw || !confirmPw}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
            padding: '12px 0', borderRadius: 12,
            background: (loading || !currentPw || !newPw || !confirmPw) ? 'var(--muted)' : 'var(--primary)',
            color: (loading || !currentPw || !newPw || !confirmPw) ? 'var(--muted-foreground)' : 'var(--primary-foreground)',
            fontSize: 14, fontWeight: 600, border: 'none',
            cursor: (loading || !currentPw || !newPw || !confirmPw) ? 'not-allowed' : 'pointer' }}>
          {loading ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : t.savePassword}
        </button>
      </form>
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

function NotificationsPage({ t, onBack }: { t: T; onBack: () => void }) {
  const notifications = useSettingsStore((s) => s.notifications);
  const toggleNotification = useSettingsStore((s) => s.toggleNotification);
  const rows: { key: keyof NotificationSettings; label: string }[] = [
    { key: 'transactionAlerts', label: t.notifTx },
    { key: 'rateAlerts',        label: t.notifRate },
    { key: 'email',             label: t.notifEmail },
    { key: 'sms',               label: t.notifSms },
    { key: 'marketing',         label: t.notifMarketing },
  ];
  return (
    <SubScreen title={t.notifications} onBack={onBack}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <ToggleRow key={row.key} label={row.label} checked={notifications[row.key]}
            onChange={() => toggleNotification(row.key)} last={i === rows.length - 1} />
        ))}
      </div>
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// HELP & SUPPORT — chat that surfaces live on the Dashboard for admins
// ═════════════════════════════════════════════════════════════════════════════

function HelpPage({ t, onBack }: { t: T; onBack: () => void }) {
  const user = useAuthStore(selectCurrentUser);
  const { messages, sendUserMessage } = useSupportChat(user?.id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  function send(text: string) {
    if (!text.trim() || !user) return;
    sendUserMessage(text.trim());
    setDraft('');
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }

  const quickReplies = [t.quickReportIssue, t.quickTxFailed, t.quickAccountIssue];

  return (
    <SubScreen title={t.help} onBack={onBack}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
        display: 'flex', flexDirection: 'column', height: 420, overflow: 'hidden' }}>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '80%', padding: '10px 14px', borderRadius: '4px 14px 14px 14px',
            background: 'var(--muted)', color: 'var(--foreground)', fontSize: 13.5 }}>
            {t.helpGreeting}
          </div>
          {messages.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%', padding: '10px 14px', fontSize: 13.5,
              borderRadius: m.from === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
              background: m.from === 'user' ? 'var(--primary)' : 'var(--muted)',
              color: m.from === 'user' ? 'var(--primary-foreground)' : 'var(--foreground)',
            }}>
              {m.text}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px' }}>
          {quickReplies.map((q) => (
            <button key={q} onClick={() => send(q)}
              style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer' }}>
              {q}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px', borderTop: '1px solid var(--border)' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(draft); }}
            placeholder={t.chatPlaceholder}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 22, border: '1.5px solid var(--border)',
              background: 'var(--input-background)', color: 'var(--foreground)', fontSize: 13.5, outline: 'none' }}
          />
          <button onClick={() => send(draft)} aria-label={t.send}
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--primary)',
              color: 'var(--primary-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0 }}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </SubScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ProfileView — root component / router
// ═════════════════════════════════════════════════════════════════════════════

export function ProfileView() {
  const logout = useAuthStore((s) => s.logout);
  const language = useSettingsStore((s) => s.language);
  const t = STRINGS[language];
  const [page, setPage] = useState<Page>('main');

  const goMain = () => setPage('main');

  return (
    <div className="max-w-lg mx-auto">
      <AnimatePresence mode="wait">
        {page === 'main' && (
          <motion.div key="main" exit={{ opacity: 0 }}>
            <h1 style={{ color: 'var(--foreground)', marginBottom: 4 }}>{t.profile}</h1>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 18 }}>{t.profileSub}</p>
            <MainMenu t={t} onNav={setPage} logout={logout} />
          </motion.div>
        )}
        {page === 'personal'      && <PersonalInfoPage key="personal" t={t} onBack={goMain} />}
        {page === 'accounts'      && <AccountsPage key="accounts" t={t} onBack={goMain} />}
        {page === 'language'      && <LanguagePage key="language" t={t} onBack={goMain} />}
        {page === 'theme'         && <ThemePage key="theme" t={t} onBack={goMain} />}
        {page === 'kyc'           && <KycPage key="kyc" t={t} onBack={goMain} />}
        {page === 'security'      && <SecurityPage key="security" t={t} onBack={goMain} />}
        {page === 'password'      && <PasswordPage key="password" t={t} onBack={goMain} />}
        {page === 'notifications' && <NotificationsPage key="notifications" t={t} onBack={goMain} />}
        {page === 'help'          && <HelpPage key="help" t={t} onBack={goMain} />}
      </AnimatePresence>
    </div>
  );
}
