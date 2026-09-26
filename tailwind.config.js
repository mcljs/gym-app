// Paleta oscura única: vive en un JSON para compartirla con el código TS
// (colores del header de navegación, placeholders, etc.) sin duplicar valores.
const palette = require('./src/constants/palette.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: palette,
    },
  },
  plugins: [],
};
