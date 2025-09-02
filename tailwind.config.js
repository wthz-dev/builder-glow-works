/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#d97706', // อำพัน 600
          secondary: '#92400e', // อำพัน 800
          accent: '#c2410c', // ส้มอิฐ 600
        },
        broth: '#b45309', // น้ำซุปเข้ม
        noodle: '#f5e6d3', // สีเส้น
        chili: '#dc2626', // เผ็ด
        leaf: '#16a34a', // ผัก/สดชื่น
        ink: '#0f172a', // ข้อความเข้ม
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [],
}
