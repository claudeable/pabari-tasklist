/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1a3a2a',
          mid: '#2d6a4f',
          light: '#40916c',
          pale: '#d8f3dc',
        },
        gold: {
          DEFAULT: '#b5833a',
          light: '#f4e4c1',
        }
      }
    },
  },
  plugins: [],
}
