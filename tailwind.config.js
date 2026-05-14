/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand core ──────────────────────────────────────────────
        primary:       '#C9A86A',   // Gold — brand moments only
        'primary-dim': '#A8894F',

        // ── Clinical palette ────────────────────────────────────────
        clinical:      '#1E6091',   // medical blue — primary accent
        'clinical-bg': '#EAF2F9',
        feature:       '#0A2540',   // deep navy hero surfaces
        mint:          '#7EC8A8',   // sparkline / accent

        // ── Neutrals ────────────────────────────────────────────────
        obsidian:      '#0A1426',   // primary text — deep navy
        ivory:         '#FFFFFF',   // page bg
        cream:         '#F1F4F8',   // chrome / sidebar bg
        sand:          '#E7EBF0',   // border default
        muted:         '#475569',   // slate-600 — secondary text
        hint:          '#94A3B8',   // slate-400 — tertiary / placeholder
        subtle:        '#FAFBFC',   // almost-white surface

        // ── Legacy aliases (back-compat — point to new clinical palette) ─
        'bg-soft':      '#F1F4F8',
        'clinical-dark':'#0A2540',
        'text-main':    '#0A1426',
        'text-muted':   '#475569',
        'accent-gold':  '#C9A86A',
        'brand-green':  '#7EC8A8',

        // ── Semantic status ─────────────────────────────────────────
        success: { DEFAULT: '#059669', light: '#E7F5EF', text: '#065F46' },
        warning: { DEFAULT: '#B85D0A', light: '#FDF1E1', text: '#92400E' },
        danger:  { DEFAULT: '#B3324A', light: '#FBE6EA', text: '#991B1B' },
        info:    { DEFAULT: '#1E6091', light: '#EAF2F9', text: '#1D4ED8' },

        // ── AI feature colour ────────────────────────────────────────
        ai: { DEFAULT: '#0A2540', accent: '#C9A86A' },
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
        // Minimal, cool-toned — only functional elevation
        'card':   '0 1px 2px 0 rgba(10,20,38,0.04), 0 1px 1px -1px rgba(10,20,38,0.03)',
        'panel':  '0 4px 16px -4px rgba(10,20,38,0.08)',
        'modal':  '0 20px 48px -12px rgba(10,20,38,0.18)',
        'focus':  '0 0 0 3px rgba(30,96,145,0.22)',
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
