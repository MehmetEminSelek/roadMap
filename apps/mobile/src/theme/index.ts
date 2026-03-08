// ─── Precision Garage — Shared Dark Theme Tokens ──────────────────────────────
// Used consistently across all screens for the dark automotive aesthetic.

export const C = {
  // Backgrounds
  bg:          '#090909',   // page background
  surface:     '#111111',   // slightly elevated surface
  card:        '#181818',   // card / input background
  border:      '#252525',   // visible border
  borderMuted: '#1A1A1A',   // subtle divider

  // Brand Accent — Gold
  gold:        '#D4952A',
  goldLight:   '#E8AE4C',
  goldSubtle:  'rgba(212,149,42,0.12)',
  goldDim:     'rgba(212,149,42,0.06)',

  // Text
  text:        '#F0F0F0',
  textSoft:    '#777777',
  textFaint:   '#3A3A3A',

  // Semantic
  success:     '#30D158',
  danger:      '#FF453A',
  dangerSubtle:'rgba(255,69,58,0.12)',

  // Fuel type colors
  fuel: {
    PETROL:   '#FF9F0A',
    DIZEL:    '#0A84FF',
    HYBRID:   '#30D158',
    ELECTRIC: '#5AC8FA',
    LPG:      '#BF5AF2',
  } as Record<string, string>,
} as const;

export type ThemeColors = typeof C;
