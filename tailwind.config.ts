import type { Config } from "tailwindcss";

const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f8fb",
          100: "#eceff4",
          200: "#d7dde7",
          300: "#b6c1d1",
          400: "#8e9caf",
          500: "#6b778b",
          600: "#4f5a6d",
          700: "#3d4656",
          800: "#2b3340",
          900: "#171d28"
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
