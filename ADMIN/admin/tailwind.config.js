// tailwind.config.js
module.exports = {
  darkMode: ['class'],
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        brand: {
          50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',
          400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',
          800:'#3730a3',900:'#312e81'
        }
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 8px 24px rgba(0,0,0,.06)',
        soft: '0 2px 10px rgba(0,0,0,.05)',
      }
    }
  },
  plugins: [require('@tailwindcss/forms')],
};
