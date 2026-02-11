import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4fbff",
          100: "#e5f6ff",
          200: "#bce8ff",
          300: "#8fd6ff",
          400: "#4cbcff",
          500: "#1aa0ff",
          600: "#007edd",
          700: "#0063b0",
          800: "#0b4a82",
          900: "#123f6b"
        }
      },
      boxShadow: {
        panel: "0 14px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
