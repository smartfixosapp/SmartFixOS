/** @type {import('tailwindcss').Config} */
/* ──────────────────────────────────────────────────────────────────────────
 * SmartFixOS — Apple-style design system (Fase 1)
 *
 * Extiende shadcn/ui existente. NO rompe clases previas.
 * Agrega:
 *   - Tipografía Apple HIG (largeTitle, title1..3, headline, body, etc.)
 *   - Paleta Apple systemGray 1..6 + accent iOS (blue / green / red / orange...)
 *   - Radii estilo squircle (6/10/14/20/28)
 *   - Spacing 4pt-grid
 *   - Sombras "material" (regular/thick/thin/ultraThin)
 *   - Easing springs y duraciones HIG
 * ────────────────────────────────────────────────────────────────────────── */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      /* ── Tipografía (Apple HIG) ─────────────────────────────────────── */
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter var"',
          'Inter',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          '"SF Pro Display"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Inter var"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        // Apple HIG escala — [tamaño, { lineHeight, letterSpacing, fontWeight }]
        'caption2':   ['0.6875rem', { lineHeight: '0.8125rem', letterSpacing: '0.006em', fontWeight: '400' }], // 11
        'caption1':   ['0.75rem',   { lineHeight: '1rem',       letterSpacing: '0',       fontWeight: '400' }], // 12
        'footnote':   ['0.8125rem', { lineHeight: '1.125rem',   letterSpacing: '-0.003em',fontWeight: '400' }], // 13
        'subheadline':['0.9375rem', { lineHeight: '1.25rem',    letterSpacing: '-0.01em', fontWeight: '400' }], // 15
        'callout':    ['1rem',      { lineHeight: '1.3125rem',  letterSpacing: '-0.013em',fontWeight: '400' }], // 16
        'body':       ['1.0625rem', { lineHeight: '1.375rem',   letterSpacing: '-0.016em',fontWeight: '400' }], // 17
        'headline':   ['1.0625rem', { lineHeight: '1.375rem',   letterSpacing: '-0.016em',fontWeight: '600' }], // 17 semibold
        'title3':     ['1.25rem',   { lineHeight: '1.5625rem',  letterSpacing: '-0.019em',fontWeight: '600' }], // 20
        'title2':     ['1.375rem',  { lineHeight: '1.6875rem',  letterSpacing: '-0.022em',fontWeight: '700' }], // 22
        'title1':     ['1.75rem',   { lineHeight: '2.125rem',   letterSpacing: '-0.025em',fontWeight: '700' }], // 28
        'large-title':['2.125rem',  { lineHeight: '2.5625rem',  letterSpacing: '-0.028em',fontWeight: '700' }], // 34
        'hero':       ['3rem',      { lineHeight: '3.375rem',   letterSpacing: '-0.032em',fontWeight: '700' }], // 48
      },

      /* ── Paleta Apple (coexiste con los tokens shadcn hsl(var(...))) ── */
      colors: {
        /* shadcn existente — no tocar */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },

        /* Apple system colors — accent y semánticos iOS/macOS */
        apple: {
          blue:    'rgb(var(--apple-blue) / <alpha-value>)',
          green:   'rgb(var(--apple-green) / <alpha-value>)',
          indigo:  'rgb(var(--apple-indigo) / <alpha-value>)',
          orange:  'rgb(var(--apple-orange) / <alpha-value>)',
          pink:    'rgb(var(--apple-pink) / <alpha-value>)',
          purple:  'rgb(var(--apple-purple) / <alpha-value>)',
          red:     'rgb(var(--apple-red) / <alpha-value>)',
          teal:    'rgb(var(--apple-teal) / <alpha-value>)',
          yellow:  'rgb(var(--apple-yellow) / <alpha-value>)',
          mint:    'rgb(var(--apple-mint) / <alpha-value>)',
          cyan:    'rgb(var(--apple-cyan) / <alpha-value>)',
          brown:   'rgb(var(--apple-brown) / <alpha-value>)',
        },

        /* Grises neutros sistema (iOS systemGray 1..6) */
        gray: {
          sys1: 'rgb(var(--sys-gray-1) / <alpha-value>)',
          sys2: 'rgb(var(--sys-gray-2) / <alpha-value>)',
          sys3: 'rgb(var(--sys-gray-3) / <alpha-value>)',
          sys4: 'rgb(var(--sys-gray-4) / <alpha-value>)',
          sys5: 'rgb(var(--sys-gray-5) / <alpha-value>)',
          sys6: 'rgb(var(--sys-gray-6) / <alpha-value>)',
        },

        /* Labels sistema — textos con jerarquía iOS */
        label: {
          primary:   'rgb(var(--label-primary) / <alpha-value>)',
          secondary: 'rgb(var(--label-secondary) / <alpha-value>)',
          tertiary:  'rgb(var(--label-tertiary) / <alpha-value>)',
          quaternary:'rgb(var(--label-quaternary) / <alpha-value>)',
        },

        /* Superficies sistema */
        surface: {
          DEFAULT:  'rgb(var(--surface-primary) / <alpha-value>)',
          secondary:'rgb(var(--surface-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--surface-tertiary) / <alpha-value>)',
          grouped:  'rgb(var(--surface-grouped) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
        },
      },

      /* ── Radii estilo squircle / continuous corners ────────────────── */
      borderRadius: {
        /* shadcn existente */
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        /* Apple HIG */
        'apple-xs': '0.375rem',  // 6px  — chips, badges
        'apple-sm': '0.625rem',  // 10px — buttons
        'apple-md': '0.875rem',  // 14px — inputs, small cards
        'apple-lg': '1.25rem',   // 20px — cards, modals
        'apple-xl': '1.75rem',   // 28px — sheets, large containers
        'apple-2xl':'2.25rem',   // 36px — hero / feature cards
        'squircle': '28% / 44%', // CSS "continuous" approximation
      },

      /* ── Espaciado 4pt-grid (extensión — el resto de Tailwind sigue) */
      spacing: {
        '4.5': '1.125rem', // 18
        '5.5': '1.375rem', // 22
        '7.5': '1.875rem', // 30
        '13':  '3.25rem',  // 52
        '15':  '3.75rem',  // 60
        '17':  '4.25rem',  // 68
        '18':  '4.5rem',   // 72
        '22':  '5.5rem',   // 88
        /* safe-area insets */
        'safe-top':    'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left':   'env(safe-area-inset-left, 0px)',
        'safe-right':  'env(safe-area-inset-right, 0px)',
      },

      /* ── Sombras estilo Apple materials ─────────────────────────────── */
      boxShadow: {
        'apple-xs':     '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.03)',
        'apple-sm':     '0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)',
        'apple-md':     '0 4px 12px rgb(0 0 0 / 0.08), 0 2px 4px rgb(0 0 0 / 0.04)',
        'apple-lg':     '0 8px 24px rgb(0 0 0 / 0.10), 0 4px 8px rgb(0 0 0 / 0.05)',
        'apple-xl':     '0 20px 48px rgb(0 0 0 / 0.14), 0 8px 16px rgb(0 0 0 / 0.08)',
        'apple-2xl':    '0 32px 64px rgb(0 0 0 / 0.18), 0 12px 24px rgb(0 0 0 / 0.10)',
        'apple-focus':  '0 0 0 4px rgb(var(--apple-blue) / 0.25)',
        'apple-rim':    'inset 0 1px 0 rgb(255 255 255 / 0.08), inset 0 -1px 0 rgb(0 0 0 / 0.20)',
      },

      /* ── Timing / motion (springs Apple) ─────────────────────────────── */
      transitionTimingFunction: {
        'apple':        'cubic-bezier(0.4, 0.0, 0.2, 1)',          // standard
        'apple-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',       // playful overshoot
        'apple-smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',    // decelerate
        'apple-in':     'cubic-bezier(0.42, 0, 1, 1)',
        'apple-out':    'cubic-bezier(0, 0, 0.58, 1)',
      },
      transitionDuration: {
        '250':  '250ms',
        '350':  '350ms',
        '450':  '450ms',
        '600':  '600ms',
      },

      /* ── Blurs (para liquid glass / vibrancy) ───────────────────────── */
      backdropBlur: {
        'apple-thin':    '8px',
        'apple-regular': '20px',
        'apple-thick':   '40px',
      },
      backdropSaturate: {
        'apple': '180%',
        'apple-strong': '200%',
      },

      /* ── Animaciones base ───────────────────────────────────────────── */
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'apple-fade-in':   { from: { opacity: '0' },                         to: { opacity: '1' } },
        'apple-scale-in':  { from: { opacity: '0', transform: 'scale(0.96)' },to: { opacity: '1', transform: 'scale(1)' } },
        'apple-slide-up':  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'apple-sheet-up':  { from: { transform: 'translateY(100%)' },        to: { transform: 'translateY(0)' } },
        'apple-bounce-in': {
          '0%':   { opacity: '0', transform: 'scale(0.85)' },
          '60%':  { opacity: '1', transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'apple-fade-in':   'apple-fade-in 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'apple-scale-in':  'apple-scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'apple-slide-up':  'apple-slide-up 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'apple-sheet-up':  'apple-sheet-up 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'apple-bounce-in': 'apple-bounce-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("tailwindcss-safe-area"),
  ],
}
