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
        // "font-serif" is kept as the heading utility name used throughout
        // the app, but now resolves to the same institutional sans as body
        // text — an elite geometric type system (Inter), not an editorial
        // serif. Only the weight/size differs between headings and body.
        serif: ["var(--font-body)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
