export const designTokens = {
  colors: {
    slate950: '#071320',
    slate925: '#09111b',
    slate900: '#091724',
    surfaceOverlay: 'rgba(7, 19, 32, 0.84)',
    surfaceOverlayStrong: 'rgba(7, 19, 32, 0.72)',
    white: '#ffffff',
    whiteSoft: 'rgba(255, 255, 255, 0.08)',
    whiteMuted: 'rgba(255, 255, 255, 0.05)',
    whiteHairline: 'rgba(255, 255, 255, 0.03)',
    whiteHover: 'rgba(255, 255, 255, 0.18)',
    amber300: '#f3c66b',
    coral400: '#ff7d66',
    sky300: '#77d1ff',
    skyGlow: 'rgba(119, 209, 255, 0.28)',
    emberGlow: 'rgba(255, 125, 102, 0.25)',
    textPrimary: '#f2f7ff',
    textSecondary: 'rgba(224, 234, 248, 0.74)',
    textBase: '#e8f0fb',
    shadowBase: 'rgba(2, 10, 16, 0.36)',
  },
  semantic: {
    surface: {
      primary: 'var(--gc-surface-primary)',
      secondary: 'var(--gc-surface-secondary)',
      elevated: 'var(--gc-surface-elevated)',
      accent: 'var(--gc-surface-accent)',
    },
    text: {
      primary: 'var(--gc-text-primary)',
      secondary: 'var(--gc-text-secondary)',
      inverse: 'var(--gc-text-inverse)',
    },
    action: {
      primary: 'var(--gc-action-primary)',
      primaryHover: 'var(--gc-action-primary-hover)',
      secondary: 'var(--gc-action-secondary)',
    },
    border: {
      subtle: 'var(--gc-border-subtle)',
      strong: 'var(--gc-border-strong)',
    },
    status: {
      success: 'var(--gc-status-success)',
      warning: 'var(--gc-status-warning)',
      error: 'var(--gc-status-error)',
    },
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    10: '40px',
    12: '48px',
    14: '56px',
  },
  typography: {
    fontFamily: {
      body: "'Space Grotesk', 'Segoe UI', sans-serif",
      display: "'Sora', 'Space Grotesk', sans-serif",
    },
    fontSize: {
      xs: '0.78rem',
      sm: '1.05rem',
      md: '1.3rem',
      lg: '1.35rem',
      xl: '1.5rem',
      hero: 'clamp(3rem, 6vw, 5.5rem)',
      section: 'clamp(1.5rem, 3vw, 2.2rem)',
    },
    fontWeight: {
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      compact: '0.95',
      body: '1.6',
    },
    letterSpacing: {
      tight: '-0.04em',
      eyebrow: '0.2em',
      eyebrowSoft: '0.16em',
      brand: '0.08em',
    },
  },
  radii: {
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '28px',
    xxl: '32px',
    pill: '999px',
  },
  shadows: {
    soft: '0 18px 60px rgba(2, 10, 16, 0.36)',
    action: '0 16px 40px rgba(255, 125, 102, 0.25)',
  },
  motion: {
    duration: {
      fast: '180ms',
    },
    easing: {
      standard: 'ease',
    },
  },
  breakpoints: {
    tablet: '980px',
  },
  zIndex: {
    sticky: 5,
  },
  opacity: {
    subtle: '0.72',
    muted: '0.74',
  },
  sizing: {
    brandMark: '46px',
    heroGlowHeight: '320px',
  },
} as const

export type DesignTokens = typeof designTokens

export const themeCss = `
:root {
  --gc-surface-primary: rgba(7, 19, 32, 0.84);
  --gc-surface-secondary: rgba(255, 255, 255, 0.04);
  --gc-surface-elevated: rgba(7, 19, 32, 0.72);
  --gc-surface-accent: linear-gradient(145deg, rgba(243, 198, 107, 0.16), rgba(119, 209, 255, 0.12));
  --gc-text-primary: #f2f7ff;
  --gc-text-secondary: rgba(224, 234, 248, 0.74);
  --gc-text-inverse: #09111b;
  --gc-action-primary: linear-gradient(135deg, #f3c66b, #ff7d66 56%, #77d1ff);
  --gc-action-primary-hover: linear-gradient(135deg, #f3c66b, #ff7d66 52%, #77d1ff);
  --gc-action-secondary: rgba(255, 255, 255, 0.05);
  --gc-border-subtle: rgba(255, 255, 255, 0.08);
  --gc-border-strong: rgba(255, 255, 255, 0.28);
  --gc-status-success: #71d39a;
  --gc-status-warning: #f3c66b;
  --gc-status-error: #ff7d66;
}

[data-theme='dark'] {
  --gc-surface-primary: rgba(7, 19, 32, 0.84);
  --gc-surface-secondary: rgba(255, 255, 255, 0.04);
  --gc-surface-elevated: rgba(7, 19, 32, 0.72);
  --gc-surface-accent: linear-gradient(145deg, rgba(243, 198, 107, 0.16), rgba(119, 209, 255, 0.12));
  --gc-text-primary: #f2f7ff;
  --gc-text-secondary: rgba(224, 234, 248, 0.74);
  --gc-text-inverse: #09111b;
}

[data-theme='light'] {
  --gc-surface-primary: rgba(243, 247, 252, 0.92);
  --gc-surface-secondary: rgba(255, 255, 255, 0.88);
  --gc-surface-elevated: rgba(255, 255, 255, 0.96);
  --gc-surface-accent: linear-gradient(145deg, rgba(243, 198, 107, 0.2), rgba(119, 209, 255, 0.18));
  --gc-text-primary: #102033;
  --gc-text-secondary: rgba(16, 32, 51, 0.72);
  --gc-text-inverse: #ffffff;
}
`