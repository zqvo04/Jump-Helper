/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#0d1117',
          2: '#161b22',
          3: '#1c2333',
          4: '#21262d',
        },
        border: '#30363d',
        accent: {
          DEFAULT: '#00e5ff',
          dim: '#00b8d9',
          muted: 'rgba(0,229,255,0.12)',
        },
        amber: {
          DEFAULT: '#f5a623',
          dim: 'rgba(245,166,35,0.15)',
        },
        success: '#3fb950',
        danger: '#f85149',
        muted: '#8b949e',
        subtle: '#6e7681',
      },
    },
  },
  plugins: [],
}
