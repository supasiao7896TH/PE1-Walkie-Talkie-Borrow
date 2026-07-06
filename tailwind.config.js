/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sarabun', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          light: '#60a5fa',
          dark: '#1e40af',
          glow: 'rgba(37, 99, 235, 0.15)'
        },
        surface: {
          page: '#0f0f12',
          card: '#18181c',
          raised: '#22222a',
          overlay: '#2d2d38'
        }
      }
    }
  }
};
