export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        neon: '0 0 30px rgba(0,255,136,0.25)',
      },
      keyframes: {
        pulse: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
      },
      animation: {
        pulse: 'pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
