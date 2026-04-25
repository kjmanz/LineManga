import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans-jp)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
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
        panel: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)"
      }
    }
  },
  plugins: []
};

export default config;
