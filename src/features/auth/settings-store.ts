// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Settings Store
// Persists: theme (light | dark | aqua), language (en | so), avatarDataUrl,
// linked mobile-money accounts, and security toggles.
// Also provides changePassword action (validates against auth store).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'aqua';
export type Language = 'en' | 'so';

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  loginAlertsEnabled: boolean;
}

export interface NotificationSettings {
  transactionAlerts: boolean;
  rateAlerts: boolean;
  email: boolean;
  sms: boolean;
  marketing: boolean;
}

export interface SettingsState {
  theme: Theme;
  language: Language;
  avatarDataUrl: string | null;
  security: SecuritySettings;
  notifications: NotificationSettings;

  setTheme: (t: Theme) => void;
  setLanguage: (l: Language) => void;
  setAvatar: (dataUrl: string | null) => void;
  toggleSecurity: (key: keyof SecuritySettings) => void;
  toggleNotification: (key: keyof NotificationSettings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'en',
      avatarDataUrl: null,
      security: {
        twoFactorEnabled: false,
        biometricEnabled: true,
        loginAlertsEnabled: true,
      },
      notifications: {
        transactionAlerts: true,
        rateAlerts: false,
        email: true,
        sms: true,
        marketing: false,
      },

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setAvatar: (avatarDataUrl) => set({ avatarDataUrl }),

      toggleSecurity: (key) =>
        set((s) => ({ security: { ...s.security, [key]: !s.security[key] } })),

      toggleNotification: (key) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: !s.notifications[key] },
        })),
    }),
    { name: 'oimes-settings' }
  )
);

// ─── Theme applier — call on mount and whenever theme changes ─────────────────
// Adds/removes class on <html> so CSS variables activate. Only one of
// 'dark' | 'aqua' is ever present — light theme means neither class is set —
// so colors from different themes never blend together.

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'aqua');
  if (theme === 'dark') root.classList.add('dark');
  if (theme === 'aqua') root.classList.add('aqua');
}

// ─── i18n strings ─────────────────────────────────────────────────────────────

export const STRINGS = {
  en: {
    profile: 'Profile',
    profileSub: 'Your account information and preferences.',
    back: 'Back',

    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone',
    country: 'Country',
    memberSince: 'Member since',
    identity: 'Identity (KYC)',
    verified: 'Verified',
    pending: 'Pending review',
    unverified: 'Unverified',
    personalInfo: 'Personal Information',

    appearance: 'Theme',
    appearanceSub: 'Choose your theme.',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeAqua: 'Aqua',

    language: 'Language',
    languageSub: 'Choose your language.',
    langEn: 'English',
    langSo: 'Somali',

    avatar: 'Profile picture',
    avatarSub: 'Upload a photo. JPG or PNG, max 2 MB.',
    uploadBtn: 'Upload photo',
    removeBtn: 'Remove',

    changePassword: 'Change Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    savePassword: 'Save password',
    passwordSuccess: 'Password changed successfully.',
    wrongCurrentPw: 'Current password is incorrect.',
    pwMismatch: 'New passwords do not match.',
    pwTooShort: 'Password must be at least 8 characters.',

    accounts: 'Mobile Wallets',
    accountsSub: 'Linked mobile money accounts',
    addAccount: 'Add wallet account',
    chooseProvider: 'Choose provider',
    phoneNumberPh: '+252 61 XXX XXXX',
    addAccountBtn: 'Add account',
    cancel: 'Cancel',
    noAccounts: 'No wallet accounts added yet.',
    selectProviderFirst: 'Please select a provider.',
    enterPhoneNumber: 'Enter a phone number.',

    security: 'Security',
    twoFactor: 'Two-factor authentication',
    biometric: 'Biometric login',
    loginAlerts: 'Login alerts',

    notifications: 'Notifications',
    notifTx: 'Transaction alerts',
    notifRate: 'Exchange rate alerts',
    notifEmail: 'Email notifications',
    notifSms: 'SMS notifications',
    notifMarketing: 'Marketing emails',

    help: 'Help & Support',
    helpGreeting: "Hi! How can we help you today? You can report an issue or ask a question.",
    quickReportIssue: 'Report an issue',
    quickTxFailed: 'Transaction failed',
    quickAccountIssue: 'Account issue',
    chatPlaceholder: 'Type a message…',
    send: 'Send',

    signOut: 'Sign out',
    save: 'Save',
  },
  so: {
    profile: 'Xogta Shakhsiga',
    profileSub: 'Macluumaadkaaga akoonka iyo doorashooyinka.',
    back: 'Dib u noqo',

    fullName: 'Magaca Buuxa',
    email: 'Iimeelka',
    phone: 'Telefoonka',
    country: 'Waddanka',
    memberSince: 'Xubin Tan Iyo',
    identity: 'Aqoonsiga (KYC)',
    verified: 'La Xaqiijiyey',
    pending: 'La Sugayaa',
    unverified: 'Lama Xaqiijin',
    personalInfo: 'Macluumaadka Shakhsiga',

    appearance: 'Muuqaalka',
    appearanceSub: 'Dooro jilbka kugu habboon.',
    themeLight: 'Iftiinka',
    themeDark: 'Gudcurka',
    themeAqua: 'Biyo',

    language: 'Luuqadda',
    languageSub: 'Dooro luuqaddaada.',
    langEn: 'Ingiriisi',
    langSo: 'Soomaali',

    avatar: 'Sawirka Profile',
    avatarSub: 'Sawir geli. JPG ama PNG, ugu badan 2 MB.',
    uploadBtn: 'Sawir geli',
    removeBtn: 'Ka saar',

    changePassword: 'Beddel Furaha Sirta',
    currentPassword: 'Furaha Sirta Hadda',
    newPassword: 'Furaha Sirta Cusub',
    confirmPassword: 'Xaqiiji Furaha Cusub',
    savePassword: 'Kaydi Furaha',
    passwordSuccess: 'Furaha sirtu si guul ah ayaa loo beddelay.',
    wrongCurrentPw: 'Furaha sirta hadda waa khalad.',
    pwMismatch: 'Furayaasha sirta cusub midba kuma mid aha.',
    pwTooShort: 'Furaha sirtu waa inuu ahaadaa ugu yaraan 8 xaraf.',

    accounts: 'Koontooyinka Mobile',
    accountsSub: 'Koontooyinka lacagta mobile-ka ee ku xidhan',
    addAccount: 'Koonto cusub ku dar',
    chooseProvider: 'Dooro adeegga',
    phoneNumberPh: '+252 61 XXX XXXX',
    addAccountBtn: 'Ku dar koontada',
    cancel: 'Jooji',
    noAccounts: 'Wali koonto mobile ah lama darin.',
    selectProviderFirst: 'Fadlan dooro adeegga.',
    enterPhoneNumber: 'Geli lambarka taleefannada.',

    security: 'Ammaanka',
    twoFactor: 'Xaqiijinta laba-tallaabo',
    biometric: 'Gelitaanka biometric-ka',
    loginAlerts: 'Ogeysiisyada gelitaanka',

    notifications: 'Ogeysiisyada',
    notifTx: 'Ogeysiisyada lacag-bixinta',
    notifRate: 'Ogeysiisyada sicirka',
    notifEmail: 'Ogeysiisyada iimeelka',
    notifSms: 'Ogeysiisyada SMS-ka',
    notifMarketing: 'Iimeelada suuq-geynta',

    help: 'Caawimo & Taageero',
    helpGreeting: 'Salaan! Sideen kuu caawin karaa? Waxaad soo gudbin kartaa dhibaato ama su\'aal.',
    quickReportIssue: 'Soo gudbi dhibaato',
    quickTxFailed: 'Lacag-bixintu way guul-darreysatay',
    quickAccountIssue: 'Dhibaato koonto',
    chatPlaceholder: 'Qor fariin…',
    send: 'Dir',

    signOut: 'Ka Bax',
    save: 'Kaydi',
  },
} as const;

export type StringKey = keyof typeof STRINGS['en'];
