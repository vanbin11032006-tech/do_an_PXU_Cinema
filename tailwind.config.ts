import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--bg-base) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        line: 'rgb(var(--border-subtle) / <alpha-value>)',
        ink: 'rgb(var(--text-primary) / <alpha-value>)',
        ink2: 'rgb(var(--text-secondary) / <alpha-value>)',
        muted: 'rgb(var(--text-muted) / <alpha-value>)',
        brand: {
          DEFAULT: '#ff6600',
          50: '#fff4ec',
          100: '#ffe3cc',
          200: '#ffc499',
          300: '#ff9d5c',
          400: '#ff7d2e',
          500: '#ff6600',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        gold: '#fbbf24',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#38bdf8',
        couple: '#ec4899',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', '"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '8px', card: '12px', modal: '16px' },
      boxShadow: {
        glow: '0 0 24px rgba(255,102,0,.25)',
        card: '0 18px 40px -24px rgba(0,0,0,.85)',
        lift: '0 24px 60px -30px rgba(0,0,0,.9)',
      },
      transitionTimingFunction: { cinema: 'cubic-bezier(.22,1,.36,1)' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .35s ease-out both',
        'scale-in': 'scale-in .2s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
} satisfies Config;
