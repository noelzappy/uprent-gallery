/** @type {import('tailwindcss').Config} */
export default {
  presets: [require('tailwind-preset')],
  content: [
    './src/**/*.{html,svelte,ts}',
    '../../packages/~ui/**/*.{html,svelte,ts}',
  ],
  prefix: '.',
  theme: {
    extend: {
      animation: {
        'pulse-ring': 'pulse-ring 1.5s infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': {
            'box-shadow':
              '0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(0, 0, 0, 0.7)',
          },
          '50%': {
            'box-shadow':
              '0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 6px rgba(0, 0, 0, 0)',
          },
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.no-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      }
      addUtilities(newUtilities)
    },
  ],
}
