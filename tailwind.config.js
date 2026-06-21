/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#1a1d27',
        'surface-2': '#222639',
        border: '#2a2e42',
        text: '#e2e4eb',
        'text-muted': '#888ca6',
        'text-dim': '#5c6080',
        accent: '#6c8cff',
        'accent-dim': '#4a6adf'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace']
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.25)',
        glow: '0 0 0 1px rgba(108,140,255,0.4), 0 8px 24px rgba(108,140,255,0.15)'
      }
    }
  },
  plugins: []
}
