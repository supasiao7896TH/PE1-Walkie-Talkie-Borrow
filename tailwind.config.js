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
          light: '#1d4ed8',
          dark: '#1e40af',
          glow: 'rgba(37, 99, 235, 0.15)'
        },
        surface: {
          page: '#f5f8fc',
          card: '#ffffff',
          raised: '#eef3fa',
          overlay: '#e2e9f5'
        }
      }
    }
  }
};
