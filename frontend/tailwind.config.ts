import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './extension/**/*.{ts,tsx,html}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
