/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand core ──────────────────────────────────────────────
        primary:       '#C9A86A',   // Gold — primary brand accent
        'primary-dim': '#A8894F',

        // ── Clinical accent (warm gold, used by active-state utilities) ─
        clinical:      '#C9A86A',   // "clinical" accent → gold
        'clinical-bg': '#FAF3E6',   // soft warm gold tint
        feature:       '#1C1917',   // warm obsidian hero surfaces
        mint:          '#7EC8A8',   // sparkline / accent

        // ── Neutrals ────────────────────────────────────────────────
        obsidian:      '#1C1917',   // warm dark — primary text
        ivory:         '#FDFCFB',   // warm page bg
        cream:         '#F5F0EB',   // chrome / sidebar bg
        sand:          '#E5DDD4',   // border default
        muted:         '#6B5E52',   // warm secondary text
        hint:          '#9C8878',   // warm tertiary / placeholder
        subtle:        '#FCFAF8',   // almost-white warm surface

        // ── Legacy aliases (back-compat) ────────────────────────────
        'bg-soft':      '#F5F0EB',
        'clinical-dark':'#1C1917',
        'text-main':    '#1C1917',
        'text-muted':   '#6B5E52',
        'accent-gold':  '#C9A86A',
        'brand-green':  '#7EC8A8',

        // ── Semantic status ─────────────────────────────────────────
        success: { DEFAULT: '#059669', light: '#ECFDF5', text: '#065F46' },
        warning: { DEFAULT: '#D97706', light: '#FFFBEB', text: '#92400E' },
        danger:  { DEFAULT: '#DC2626', light: '#FEF2F2', text: '#991B1B' },
        info:    { DEFAULT: '#B8860B', light: '#FAF3E6', text: '#8B6914' },

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
        // Clinical-dense UI scale (matches modern medical SaaS aesthetic)
        '2xs': ['10.5px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        'xs':  ['11.5px', { lineHeight: '15px' }],
        'sm':  ['12.5px', { lineHeight: '17px' }],
        'base':['13px',   { lineHeight: '18px' }],
        'md':  ['14px',   { lineHeight: '20px' }],
        'lg':  ['15px',   { lineHeight: '22px' }],
        'xl':  ['17px',   { lineHeight: '24px' }],
        '2xl': ['21px',   { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '3xl': ['26px',   { lineHeight: '32px', letterSpacing: '-0.015em' }],
        '4xl': ['30px',   { lineHeight: '36px', letterSpacing: '-0.02em' }],
        '5xl': ['40px',   { lineHeight: '48px', letterSpacing: '-0.025em' }],
        '6xl': ['56px',   { lineHeight: '64px', letterSpacing: '-0.03em' }],
      },

      borderRadius: {
        'sm':  '4px',
        'md':  '6px',     // inputs, badges, small cards
        'lg':  '8px',     // cards, panels
        'xl':  '12px',    // modals, large cards
        '2xl': '18px',    // hero sections
        'full':'9999px',  // pills
      },

      spacing: {
        // Portal layout constants
        'sidebar':   '232px',
        'header':    '56px',
        'panel-gap': '14px',
      },

      boxShadow: {
        // Minimal, warm-toned — only functional elevation
        'card':   '0 1px 2px 0 rgba(28,25,23,0.04), 0 1px 1px -1px rgba(28,25,23,0.03)',
        'panel':  '0 4px 16px -4px rgba(28,25,23,0.08)',
        'modal':  '0 20px 48px -12px rgba(28,25,23,0.18)',
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
