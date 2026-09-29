/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cadet: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36a8f6',
          500: '#0c8de5',
          600: '#016ec4',
          700: '#02589f',
          800: '#064b83',
          900: '#0a3f6d',
          950: '#072848',
        },
        rcac: {
          blue: '#002B49', // Royal Canadian Air Cadets deep blue
          sky: '#5CB4E5',  // Air Force Light Blue
          gold: '#FFB81C', // Canadian Gold / RCAF Eagle Yellow
          tartan: '#003366',
          alert: '#E02B20',
          gaugeBg: '#11141a',
          gaugeBezel: '#282f3b'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
