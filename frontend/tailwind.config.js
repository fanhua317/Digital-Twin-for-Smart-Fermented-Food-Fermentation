/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1890ff',
        success: '#52c41a',
        warning: '#faad14',
        error: '#ff4d4f',
        dark: {
          bg: '#141414',
          card: '#1f1f1f',
          border: '#303030',
        }
      }
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // 避免与antd冲突
  }
}
