// ─────────────────────────────────────────────────────────────────────────────
// OIMES — PlatformLogo
// Renders the real brand logo for a mobile-money platform (EVC Plus, Zaad,
// Sahal, eDahab). Falls back to a branded monogram badge if no logoUrl is
// configured, or if the remote image fails to load — so the UI never shows
// a broken image icon.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { PLATFORM_METADATA } from '../store/platform-data';
import type { MobileMoneyPlatform } from '../types';

interface PlatformLogoProps {
  platform: MobileMoneyPlatform;
  /** Diameter in pixels of the logo badge. */
  size?: number;
  /** Adds a subtle border ring — nice on light or white logo backgrounds. */
  ring?: boolean;
  className?: string;
}

export function PlatformLogo({ platform, size = 36, ring = true, className }: PlatformLogoProps) {
  const meta = PLATFORM_METADATA[platform];
  const [failed, setFailed] = useState(false);
  const showImage = !!meta.logoUrl && !failed;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: showImage ? '#FFFFFF' : `${meta.brandColor}1A`,
        border: ring ? `1px solid ${showImage ? 'var(--border)' : `${meta.brandColor}33`}` : 'none',
      }}
    >
      {showImage ? (
        <img
          src={meta.logoUrl}
          alt={`${meta.displayName} logo`}
          onError={() => setFailed(true)}
          style={{
            width: '82%',
            height: '82%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: Math.max(9, Math.round(size * 0.32)),
            fontWeight: 700,
            color: meta.brandColor,
            letterSpacing: '0.02em',
          }}
        >
          {meta.shortCode}
        </span>
      )}
    </div>
  );
}

// ─── PlatformDot ──────────────────────────────────────────────────────────────
// A tiny (default 14px) round logo used inline in compact rows — transaction
// lists, rate grids — as a drop-in replacement for the old flat colour dot.

export function PlatformDot({ platform, size = 14 }: { platform: MobileMoneyPlatform; size?: number }) {
  return <PlatformLogo platform={platform} size={size} ring={false} />;
}
