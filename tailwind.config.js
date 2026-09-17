const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        arabic: ['Amiri', 'serif'],
      },
      colors: {
        brand: {
          ...colors.teal,
          dark: '#042f2e',
        },
        emerald: colors.teal,
        accent: {
          500: '#d97706',
          600: '#b45309',
        }
      }
    },
  },
  plugins: [],
}
