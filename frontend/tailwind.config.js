/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#101113',
        panel: '#17191d',
        panelSoft: '#1d2025',
        line: '#2a2f36',
        textMain: '#e6e7e9',
        textMuted: '#9ea3ab',
        accent: '#b6b8bc',
      },
      boxShadow: {
        panel: '0 10px 30px rgba(0,0,0,0.35)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
