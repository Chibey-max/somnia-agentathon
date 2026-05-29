/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        'bg-panel': '#0f0f0f',
        'bg-elevated': '#141414',
        'bg-hover': '#1a1a1a',
        border: '#1e1e1e',
        'border-bright': '#2a2a2a',
        green: {
          DEFAULT: '#00ff88',
          dim: '#00cc6a',
          muted: '#00ff8840',
          faint: '#00ff8815',
        },
        blue: {
          DEFAULT: '#0070f3',
          bright: '#3b82f6',
        },
        orange: {
          DEFAULT: '#ff6b35',
          muted: '#ff6b3540',
        },
        red: {
          DEFAULT: '#ff3333',
          muted: '#ff333340',
        },
        yellow: {
          DEFAULT: '#ffd700',
          muted: '#ffd70030',
        },
        text: {
          primary: '#e8e8e8',
          secondary: '#888888',
          muted: '#555555',
          green: '#00ff88',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: [
          'var(--font-space-grotesk)',
          'Space Grotesk',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      boxShadow: {
        green: '0 0 20px rgba(0, 255, 136, 0.15)',
        'green-sm': '0 0 8px rgba(0, 255, 136, 0.2)',
        panel: '0 1px 0 #1e1e1e, 0 -1px 0 #1e1e1e',
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'scan': 'scan 8s linear infinite',
        'blink': 'blink 1.2s step-end infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0px rgba(0,255,136,0)' },
          '50%': { boxShadow: '0 0 12px rgba(0,255,136,0.4)' },
        },
        'scan': {
          '0%': { backgroundPosition: '0 -100%' },
          '100%': { backgroundPosition: '0 200%' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
