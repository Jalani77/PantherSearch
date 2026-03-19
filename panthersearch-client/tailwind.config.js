/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'grade-a': '#16A34A',
        'grade-b': '#65A30D',
        'grade-c': '#854D0E',
        'grade-d': '#C2410C',
        'grade-f': '#DC2626',
        'seat-open': '#16A34A',
        'seat-limited': '#D97706',
        'seat-full': '#DC2626'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
