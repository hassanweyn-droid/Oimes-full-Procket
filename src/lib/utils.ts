// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Shared Utility Functions
// Pure functions only — no side effects, no imports from app modules.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a number as a USD currency string.
 * e.g. 1250 → "$1,250.00"
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a Somali E.164 phone number with spaces for readability.
 * e.g. "+252615001234" → "+252 61 500 1234"
 */
export function formatPhoneSomali(phone: string): string {
  return phone.replace(/^(\+252)(\d{2})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
}

/**
 * Extracts up to 2 uppercase initials from a display name.
 * e.g. "Hassan Weyn" → "HW"
 */
export function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// A small fixed palette so every account gets a consistent, visually
// distinct avatar background instead of everyone sharing the same solid
// color — same seed always maps to the same color for one user.
const AVATAR_PALETTE = [
  '#0B6E4F', '#B3541E', '#5B3E8A', '#0F5C93',
  '#8A1F4E', '#3E6E1F', '#6B3E0F', '#1F5E5C',
];

/** Deterministic avatar background color derived from a stable per-user
 *  seed (their id or email) — different accounts land on different colors. */
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/**
 * Rounds a number to 2 decimal places using banker-safe arithmetic.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
