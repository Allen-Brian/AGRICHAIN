export const theme = {
  colors: {
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#BBDEFB',
    secondary: '#FF9800',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    error: '#F44336',
    success: '#4CAF50',
    warning: '#FFC107',
    text: '#212121',
    textSecondary: '#757575',
    border: '#E0E0E0',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
  },
  typography: {
    h1: {
      fontSize: 24,
      fontWeight: 'bold' as const,
    },
    h2: {
      fontSize: 20,
      fontWeight: 'bold' as const,
    },
    h3: {
      fontSize: 18,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 16,
      fontWeight: 'normal' as const,
    },
    caption: {
      fontSize: 14,
      fontWeight: 'normal' as const,
    },
    small: {
      fontSize: 12,
      fontWeight: 'normal' as const,
    },
  },
};

export type Theme = typeof theme;