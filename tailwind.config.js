/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/ui/**/*.{ts,tsx,html}', './src/shell/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        surface: {
          page: '#0c0e12',
          panel: '#12151a',
          raised: '#1a1e25',
          input: '#242930',
        },
        accent: {
          DEFAULT: '#2dd4bf',
          muted: '#14b8a6',
        },
      },
    },
  },
  plugins: [],
};
