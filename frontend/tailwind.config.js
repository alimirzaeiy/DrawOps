/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        term: {
          bg: '#121214',
          card: '#18181c',
          border: '#27c93f',
          borderMuted: '#1a472a',
          text: '#e6e6e6',
          muted: '#8b949e',
          apple: '#ff3b94', // magenta apple glyph from prompt
          green: '#27c93f',
          cyan: '#00e5ff',
          yellow: '#ffcc00',
          red: '#ff5f56'
        }
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace']
      },
      boxShadow: {
        'term-glow': '0 0 15px rgba(39, 201, 63, 0.25)',
        'term-glow-strong': '0 0 25px rgba(39, 201, 63, 0.45)',
      }
    },
  },
  plugins: [],
}
