export const colors = {
  // GitHub dark theme inspired
  bg: '#0d1117',
  bgSecondary: '#161b22',
  bgTertiary: '#21262d',
  border: '#30363d',
  borderLight: '#484f58',

  text: '#f0f6fc',
  textSecondary: '#8b949e',
  textTertiary: '#6e7681',

  primary: '#58a6ff',
  primaryDark: '#1f6feb',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
  info: '#79c0ff',

  // Syntax colors
  syntaxBg: '#0d1117',
  syntaxGutter: '#6e7681',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const fonts = {
  regular: 'System',
  mono: 'monospace',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 28,
    title: 34,
  },
} as const;
