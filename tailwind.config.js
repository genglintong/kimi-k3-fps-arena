/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ---- 枪火竞技场 design tokens (design.md §4) ---- */
        ink: '#14122E',
        'bg-deep': '#15173D',
        'bg-panel': '#20234F',
        'bg-panel-2': '#2B2F6B',
        'line-soft': '#3A3F85',
        txt: '#FFFFFF',
        'txt-mute': '#A9AEE0',
        'txt-dim': '#6E74B8',
        yel: { DEFAULT: '#FFC831', dark: '#D99400', light: '#FFD65C' },
        blu: { DEFAULT: '#3EA6FF', dark: '#1B6FD1' },
        red: { DEFAULT: '#FF5A5F', dark: '#D63A44' },
        grn: { DEFAULT: '#3ED97E', dark: '#1FA85A' },
        pur: { DEFAULT: '#9B5CFF', dark: '#6E35CC' },
        org: { DEFAULT: '#FF8A3D', dark: '#D9622B' },
        pink: { DEFAULT: '#FF6FB5', dark: '#D14E8F' },
        floor: { base: '#7FD1A8', a: '#8CDAB2', b: '#76C89E' },
        void: '#0F1030',
        /* ---- shadcn template tokens (kept for ui/ components) ---- */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        display: ['"ZCOOL KuaiLe"', '"Noto Sans SC"', 'sans-serif'],
        head: ['"ZCOOL QingKe HuangYou"', '"Noto Sans SC"', 'sans-serif'],
        num: ['Bungee', '"Noto Sans SC"', 'sans-serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      transitionTimingFunction: {
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        snap: 'cubic-bezier(0.22, 1, 0.36, 1)',
        std: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '120': '120ms',
        '250': '250ms',
        '350': '350ms',
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'btn': '0 6px 0 #14122E',
        'btn-active': '0 2px 0 #14122E',
        'keycap': '0 4px 0 #14122E',
        'panel': '0 12px 32px rgba(8, 6, 40, 0.45)',
        'glow-yel': '0 0 24px rgba(255, 200, 49, 0.5)',
        'glow-pur': '0 0 24px rgba(155, 92, 255, 0.5)',
        'glow-blu': '0 0 24px rgba(62, 166, 255, 0.5)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        float: {
          '0%, 100%': { transform: 'translateY(-14px) rotate(-6deg)' },
          '50%': { transform: 'translateY(14px) rotate(6deg)' },
        },
        'cta-breathe': {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 6px 0 #14122E, 0 0 24px rgba(255,200,49,0.35)' },
          '50%': { transform: 'scale(1.03)', boxShadow: '0 6px 0 #14122E, 0 0 42px rgba(255,200,49,0.7)' },
        },
        'key-press': {
          '0%, 100%': { transform: 'translateY(0)', boxShadow: '0 4px 0 #14122E' },
          '50%': { transform: 'translateY(3px)', boxShadow: '0 1px 0 #14122E' },
        },
        'dot-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        'float': 'float 7s ease-in-out infinite',
        'cta-breathe': 'cta-breathe 2s cubic-bezier(0.4,0,0.2,1) infinite',
        'key-press': 'key-press 0.6s cubic-bezier(0.4,0,0.2,1) 2',
        'dot-blink': 'dot-blink 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
