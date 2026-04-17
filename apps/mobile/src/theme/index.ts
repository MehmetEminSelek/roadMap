// ─── Precision Garage — Shared Light Theme Tokens ──────────────────────────────
// A clean, bright, and modern daytime aesthetic for the application.

export const C = {
  // Backgrounds
  bg:          '#F2F2F7',   // iOS grouped background (light grey)
  surface:     '#FFFFFF',   // elevated surface (pure white)
  card:        '#FFFFFF',   // card / input background
  border:      '#E5E5EA',   // visible border
  borderMuted: '#F2F2F7',   // subtle divider

  // Brand Accent — Vibrant Blue (Navigation style)
  primary:     '#0A84FF',
  primaryLight:'#409CFF',
  primarySubtle:'rgba(10, 132, 255, 0.1)',
  primaryDim:  'rgba(10, 132, 255, 0.05)',

  // Legacy mappings to not break existing components before refactor
  gold:        '#0A84FF', 
  goldLight:   '#409CFF',
  goldSubtle:  'rgba(10, 132, 255, 0.1)',
  goldDim:     'rgba(10, 132, 255, 0.05)',

  // Text
  text:        '#1C1C1E',   // high contrast text
  textSoft:    '#8E8E93',   // secondary text
  textFaint:   '#C7C7CC',   // placeholders or faint text

  // Semantic
  success:     '#34C759',
  danger:      '#FF3B30',
  dangerSubtle:'rgba(255, 59, 48, 0.1)',

  // Fuel type colors
  fuel: {
    PETROL:   '#FF9500',
    DIZEL:    '#0A84FF',
    HYBRID:   '#34C759',
    ELECTRIC: '#5AC8FA',
    LPG:      '#AF52DE',
  } as Record<string, string>,
} as const;

export type ThemeColors = typeof C;
