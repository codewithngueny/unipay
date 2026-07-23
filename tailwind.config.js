/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          maroon: '#6D001A',
          'maroon-dark': '#4d0012',
          'maroon-light': '#8a0020',
          white: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
