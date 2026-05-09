/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand core ──────────────────────────────────────────────
        primary:       '#C9A86A',   // Gold — accent only, never decorative
        'primary-dim': '#A8894F',   // Hover / pressed state

        // ── Neutrals ────────────────────────────────────────────────
        obsidian:      '#1C1917',   // replaces clinical-dark
        ivory:         '#FDFCFB',   // page background
        cream:         '#F5F0EB',   // surface / sidebar bg
        sand:          '#E5DDD4',   // border default
        muted:         '#6B5E52',   // secondary text
        hint:          '#9C8878',   // tertiary / placeholder

        // ── Legacy aliases (keep so existing components don't break) ─
        'bg-soft':      '#F5F0EB',
        'clinical-dark':'#1C1917',
        'text-main':    '#1C1917',
        'text-muted':   '#6B5E52',
        'accent-gold':  '#C9A86A',
        'brand-green':  '#4F6F52',

        // ── Semantic status ─────────────────────────────────────────
        success: { DEFAULT: '#059669', light: '#ECFDF5', text: '#065F46' },
        warning: { DEFAULT: '#D97706', light: '#FFFBEB', text: '#92400E' },
        danger:  { DEFAULT: '#DC2626', light: '#FEF2F2', text: '#991B1B' },
        info:    { DEFAULT: '#2563EB', light: '#EFF6FF', text: '#1D4ED8' },

        // ── AI feature colour ────────────────────────────────────────
        ai: { DEFAULT: '#1C1917', accent: '#C9A86A' },
      },

      fontFamily: {
        // Inter for all UI — data-dense, legible, professional
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Playfair reserved for brand/hero moments only
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // Compact UI scale — replaces the sprawling [10px]–[12px] hacks
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.01em' }],
        'xs':  ['12px', { lineHeight: '16px' }],
        'sm':  ['13px', { lineHeight: '18px' }],
        'base':['14px', { lineHeight: '20px' }],
        'md':  ['15px', { lineHeight: '22px' }],
        'lg':  ['17px', { lineHeight: '24px' }],
        'xl':  ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '38px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
        '5xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em' }],
        '6xl': ['60px', { lineHeight: '68px', letterSpacing: '-0.03em' }],
      },

      borderRadius: {
        'sm':  '6px',
        'md':  '10px',    // inputs, badges, small cards
        'lg':  '14px',    // cards, panels
        'xl':  '18px',    // modals, large cards
        '2xl': '24px',    // hero sections
        'full':'9999px',  // pills
      },

      spacing: {
        // Portal layout constants
        'sidebar':   '240px',
        'header':    '52px',
        'panel-gap': '16px',
      },

      boxShadow: {
        // Minimal — only functional elevation
        'card':   '0 1px 3px 0 rgba(28,25,23,0.06), 0 1px 2px -1px rgba(28,25,23,0.04)',
        'panel':  '0 4px 16px -4px rgba(28,25,23,0.10)',
        'modal':  '0 20px 48px -12px rgba(28,25,23,0.22)',
        'focus':  '0 0 0 3px rgba(201,168,106,0.25)',
        'none':   'none',
      },

      screens: {
        xs: '400px',
      },

      animation: {
        'fade-up':    'fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in':    'fadeIn 0.3s ease-out forwards',
        'slide-in':   'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up':   'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
      },

      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};
