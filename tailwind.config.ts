import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#090A10",
        panel: "#111420",
        line: "#27272A",
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E5C06E",
          dark: "#A8862A",
        },
        emerald: {
          DEFAULT: "#10B981",
        },
      },
      fontFamily: {
        serif: ["var(--font-display)", "serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
