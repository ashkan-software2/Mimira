// Mimira design tokens — mirrors DESIGN-UI.md (light mode, v0).
export const C = {
  bg: '#fafbfc',
  surface: '#ffffff',
  surface2: '#f7f8fa',
  fg: '#0a0a0a',
  fgMuted: '#6b7280',
  fgSubtle: '#9ca3af',
  border: '#e5e7eb',
  borderSubtle: '#f1f3f5',
  ctaFill: '#0a0a0a',
  ctaFg: '#ffffff',
  ai: '#0a7c7c',
  aiBg: '#ecf6f6',
  link: '#2563eb',
  success: '#16a34a',
  warning: '#d97706',
} as const;

export const RADIUS = {sm: 6, md: 8, lg: 12, full: 9999};
export const SHADOW_MODAL = '0 4px 20px rgba(0,0,0,0.08)';
// Easing from DESIGN-UI motion tokens.
export const EASE_ENTER = [0.16, 1, 0.3, 1] as const;
export const EASE_MOVE = [0.45, 0, 0.55, 1] as const;
