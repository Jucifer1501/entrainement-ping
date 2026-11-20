import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#09090b',
        surface: '#111114',
        elevated: '#18181b',
      },
      keyframes: {
        'flash-alert': {
          '0%, 100%': { opacity: '0' },
          '15%, 45%, 75%': { opacity: '0.92' },
          '30%, 60%, 90%': { opacity: '0.1' },
        },
      },
      animation: {
        'flash-alert': 'flash-alert 1.8s ease-in-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
