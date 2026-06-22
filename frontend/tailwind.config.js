/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
        nexora: { DEFAULT: '#1B2B6B', light: '#2D47B0', dark: '#0F1A40' },
        gold: { DEFAULT: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
        hot: '#EF4444', warm: '#F97316', cold: '#3B82F6', unqualified: '#6B7280',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: { 'fade-in': 'fadeIn 0.3s ease-in-out', 'slide-up': 'slideUp 0.3s ease-out', 'pulse-dot': 'pulseDot 2s infinite' },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pulseDot: { '0%,100%': { transform: 'scale(1)', opacity: '1' }, '50%': { transform: 'scale(1.5)', opacity: '0.7' } },
      },
      boxShadow: { glass: '0 8px 32px rgba(31, 38, 135, 0.15)', card: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' },
    },
  },
  plugins: [],
};
