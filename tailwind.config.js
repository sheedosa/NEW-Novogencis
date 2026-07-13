/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './*.{ts,tsx}', './pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './utils/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand core ──────────────────────────────────────────────
        primary:       '#C9A86A',   // Gold — accent only, never decorative
        'primary-dim': '#A8894F',   // Hover / pressed state
        'primary-soft':'#F4EDD9',   // Soft gold tint — positive moments

        // ── Neutrals (warm-premium SaaS — Oura/wellness archetype) ──
        obsidian:      '#1A1916',   // warm near-black text & primary surfaces
        ivory:         '#FAFAF8',   // page background — soft warm off-white
        cream:         '#F4F3EF',   // subtle surface / hover bg (warm-tinted)
        sand:          '#E8E6E1',   // border default (warm-tinted)
        muted:         '#6E6A65',   // secondary text (warm grey)
        hint:          '#A39E97',   // tertiary / placeholder (warm tan-grey)

        // ── Categorical chart palette (organic, color-blind safe) ──
        chart: {
          sage:       '#7FA288',
          terracotta: '#C49072',
          indigo:     '#6B7FB8',
          slate:      '#94A3B8',
        },

        // ── Legacy aliases (keep so existing components don't break) ─
        'bg-soft':      '#F4F3EF',
        'clinical-dark':'#1A1916',
        'text-main':    '#1A1916',
        'text-muted':   '#6E6A65',
        'accent-gold':  '#C9A86A',
        'brand-green':  '#7FA288',

        // ── Semantic status — muted & warm (premium-wellness) ──────
        // `bg` mirrors `light` — components reference bg-{semantic}-bg for tinted
        // alert/callout backgrounds; without this key those classes emit no rule
        // and the panels render transparent (the "broken popup" bug).
        success: { DEFAULT: '#3B8C5F', light: '#E8F0EB', bg: '#E8F0EB', text: '#2D6E47' },
        warning: { DEFAULT: '#C68726', light: '#F8F0DB', bg: '#F8F0DB', text: '#8B5E1A' },
        danger:  { DEFAULT: '#C04A4A', light: '#F4E3E1', bg: '#F4E3E1', text: '#8A3535' },
        info:    { DEFAULT: '#3B6FB8', light: '#E5ECF5', bg: '#E5ECF5', text: '#2B5285' },

        // ── AI feature colour ────────────────────────────────────────
        ai: { DEFAULT: '#1A1916', accent: '#C9A86A' },
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
        // Minimal, cool-neutral shadows
        'card':   '0 1px 2px 0 rgba(15,15,16,0.04), 0 0 0 0.5px rgba(15,15,16,0.04)',
        'panel':  '0 4px 16px -4px rgba(15,15,16,0.08)',
        'modal':  '0 20px 48px -12px rgba(15,15,16,0.18)',
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
