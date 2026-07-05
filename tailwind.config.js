/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",
    "./public/app.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: [],
}
