// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Platform Registry & Error Class
// Single responsibility: platform metadata and domain error definition.
// ─────────────────────────────────────────────────────────────────────────────

import type { MobileMoneyPlatform, OIMESErrorCode, PlatformMetadata } from '../types';
import sahalLogo from '../assets/logos/sahal-golis.png';
import edahabLogo from '../assets/logos/edahab.jpg';

// ─── Platform Registry ────────────────────────────────────────────────────────

export const PLATFORM_METADATA: Record<MobileMoneyPlatform, PlatformMetadata> = {
  evc_plus: {
    id: 'evc_plus',
    displayName: 'EVC Plus',
    shortCode: 'EVC',
    operator: 'Hormuud Telecom',
    primaryCurrency: 'USD',
    supportedCurrencies: ['USD'],
    brandColor: '#E31837',  // Hormuud red
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hormuud_logo.png',
    ussdCode: '*712#',
    transferLimits: { min: 1, max: 2000, dailyMax: 5000 },
    fee: { type: 'percentage', rate: 0.01, cap: 25 }, // 1.0%, cap $25
    isActive: true,
    supportedRegions: ['Banaadir', 'Bay', 'Bakool', 'Hiiraan', 'Shabeellaha Dhexe', 'Shabeellaha Hoose'],
  },
  zaad: {
    id: 'zaad',
    displayName: 'Zaad',
    shortCode: 'ZAD',
    operator: 'Telesom',
    primaryCurrency: 'USD',
    supportedCurrencies: ['USD'],
    brandColor: '#0072BC',  // Telesom blue
    logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Telesom_logo.png',
    ussdCode: '*977#',
    transferLimits: { min: 1, max: 2000, dailyMax: 5000 },
    fee: { type: 'percentage', rate: 0.01, cap: 25 },
    isActive: true,
    supportedRegions: ['Woqooyi Galbeed', 'Togdheer', 'Sanaag', 'Sool', 'Bari', 'Nugaal'],
  },
  sahal: {
    id: 'sahal',
    displayName: 'Sahal',
    shortCode: 'SAH',
    operator: 'Golis Telecom',
    primaryCurrency: 'USD',
    supportedCurrencies: ['USD'],
    brandColor: '#E72830',  // Golis red
    logoUrl: sahalLogo,
    ussdCode: '*888#',
    transferLimits: { min: 1, max: 1500, dailyMax: 3000 },
    fee: { type: 'percentage', rate: 0.012, cap: 20 },
    isActive: true,
    supportedRegions: ['Bari', 'Nugaal', 'Mudug', 'Karkaar', 'Ayn', 'Sool'],
  },
  edahab: {
    id: 'edahab',
    displayName: 'eDahab',
    shortCode: 'EDB',
    operator: 'Dahabshiil',
    primaryCurrency: 'USD',
    supportedCurrencies: ['USD'],
    brandColor: '#4A9344',  // Dahabshiil / eDahab green
    logoUrl: edahabLogo,
    ussdCode: '*244#',
    transferLimits: { min: 1, max: 3000, dailyMax: 10000 },
    fee: { type: 'percentage', rate: 0.015, cap: 30 },
    isActive: true,
    supportedRegions: [
      'Banaadir', 'Bari', 'Bay', 'Bakool', 'Gedo', 'Hiiraan',
      'Jubbada Dhexe', 'Jubbada Hoose', 'Mudug', 'Nugaal',
      'Sanaag', 'Shabeellaha Dhexe', 'Shabeellaha Hoose',
      'Sool', 'Togdheer', 'Woqooyi Galbeed',
    ],
  },
};

// ─── Domain Error Class ───────────────────────────────────────────────────────

export class OIMESExchangeError extends Error {
  readonly code: OIMESErrorCode;

  constructor(code: OIMESErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'OIMESExchangeError';
    this.code = code;
  }
}
