/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cr: {
          dark: '#050505',
          darker: '#000000',
          surface: '#111111',
          surfaceLight: '#1A1A1A',
          border: '#2A2A2A',
          gold: '#D4AF37',       /* Ouro Clássico */
          goldLight: '#FCE181',  /* Ouro Claro/Brilho */
          goldDark: '#AA801E',   /* Ouro Escuro/Sombra */
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Times New Roman"', 'ui-serif', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
