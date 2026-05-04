import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  /* 防止自定义色在极端 JIT 场景下未生成，导致侧栏/正文「无色」 */
  safelist: [
    'bg-coal-ink',
    'bg-parchment',
    'text-coal-ink',
    'border-ash',
    'bg-elevated',
    'bg-ledger-white',
    'text-graphite',
    'text-slate-mid',
    'border-smolder',
  ],
  theme: {
    extend: {
      colors: {
        'coal-ink': '#1c1a17',
        'ledger-white': '#fafafa',
        parchment: '#f7f3eb',
        ash: '#f1f1f1',
        'slate-mid': '#7e7d7b',
        graphite: '#5a5957',
        stone: '#969594',
        fossil: '#bab9b8',
        smolder: '#ff6020',
        'signal-violet': '#777eff',
        'deep-violet': '#731fff',
        'mint-pulse': '#05933b',
        'emerald-tag': '#10b981',
        elevated: '#ffffff',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
      },
      fontSize: {
        display: ['56px', { lineHeight: '1', letterSpacing: '-0.04em' }],
        'heading-lg': ['48px', { lineHeight: '1', letterSpacing: '-0.03em' }],
        heading: ['32px', { lineHeight: '1.13', letterSpacing: '-0.03em' }],
        'heading-sm': ['24px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        subtle:
          'rgba(95, 99, 106, 0.08) 0px 0px 0px 1px, rgba(43, 43, 48, 0.1) 0px 1px 4px 0px',
        'subtle-2':
          'rgba(95, 99, 106, 0.12) 0px 0px 0px 1px, rgba(43, 43, 48, 0.1) 0px 1px 4px 0px',
      },
      borderRadius: {
        card: '10px',
        input: '12px',
        pill: '999px',
      },
      maxWidth: {
        page: '1200px',
      },
    },
  },
  plugins: [],
} satisfies Config;
