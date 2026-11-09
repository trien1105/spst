/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#fdfbf7',
          100: '#f9f6ed',
          200: '#f3ebd6',
          300: '#e7d9b5',
          800: '#4e3a20',
          900: '#2d2213',
        },
        flagRed: {
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        goldBronze: {
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
        }
      },
      fontFamily: {
        serif: ['Merriweather', 'Georgia', 'Cambria', 'serif'],
      }
    },
  },
  plugins: [],
}

