import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          muted: 'hsl(var(--foreground-muted))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          strong: 'hsl(var(--border-strong))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          muted: 'hsl(var(--primary-muted))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          text: 'hsl(var(--success-text))',
          bg: 'hsl(var(--success-bg))',
          border: 'hsl(var(--success-border))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          text: 'hsl(var(--warning-text))',
          bg: 'hsl(var(--warning-bg))',
          border: 'hsl(var(--warning-border))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          text: 'hsl(var(--danger-text))',
          bg: 'hsl(var(--danger-bg))',
          border: 'hsl(var(--danger-border))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          text: 'hsl(var(--info-text))',
          bg: 'hsl(var(--info-bg))',
          border: 'hsl(var(--info-border))',
        },
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        display: ['1.5rem', { lineHeight: '1.875rem', letterSpacing: '-0.015em' }],
        title: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        section: ['0.8125rem', { lineHeight: '1.1875rem', letterSpacing: '-0.005em' }],
        body: ['0.8125rem', { lineHeight: '1.125rem' }],
        secondary: ['0.75rem', { lineHeight: '1rem' }],
        table: ['0.75rem', { lineHeight: '1rem' }],
        meta: ['0.6875rem', { lineHeight: '0.9375rem' }],
        label: ['0.625rem', { lineHeight: '0.8125rem', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        lg: 'calc(var(--radius) + 2px)',
        md: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)',
      },
      maxWidth: {
        page: '80rem',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
