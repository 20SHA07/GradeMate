import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-app)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "sans-serif"
        ]
      },
      colors: {
        ink: {
          50: "var(--ink-50)",
          100: "var(--ink-100)",
          200: "var(--ink-200)",
          300: "var(--ink-300)",
          400: "var(--ink-400)",
          500: "var(--ink-500)",
          600: "var(--ink-600)",
          700: "var(--ink-700)",
          800: "var(--ink-800)",
          900: "var(--ink-900)"
        },
        campus: {
          teal: "#0f766e",
          mint: "#d9f99d",
          coral: "#fb7185",
          gold: "#f59e0b"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 29, 40, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;
