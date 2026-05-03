/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          dark:    '#4338CA',
          light:   '#EEF2FF',
        },
        brand: {
          bg:      '#F8FAFC',
          surface: '#FFFFFF',
          border:  '#E2E8F0',
          text:    '#0F172A',
          muted:   '#475569',
          subtle:  '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg:      '0.75rem',
        xl:      '1rem',
      },
      boxShadow: {
        card:  '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06)',
        modal: '0 10px 25px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)',
      },
    },
  },
  plugins: [],
}
