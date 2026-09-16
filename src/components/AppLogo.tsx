import logoUrl from '../assets/app-logo.png';

interface AppLogoProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

// OIMES app mark — the winged-dollar illustration supplied for this project.
// Background is already transparent (see src/assets/app-logo.png), so it
// drops cleanly onto whatever backdrop each call site provides: a colored
// chip in the sidebar/login headers, or bare on a card background in
// AuthShell. `color` is kept in the prop type for backward compatibility
// with existing call sites but no longer changes anything — the artwork
// carries its own colors.
export function AppLogo({ size = 42, className = '', style }: AppLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="OIMES logo"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
        ...style,
      }}
    />
  );
}
