import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cr: {
          dark:         "#050505",
          darker:       "#000000",
          surface:      "#111111",
          surfaceLight: "#1A1A1A",
          border:       "#2A2A2A",
          gold:         "#D4AF37",
          goldLight:    "#FCE181",
          goldDark:     "#AA801E",
          sidebar:      "#fbfbfd",
          sidebarBorder:"#e5e5ea",
          text:         "#1d1d1f",
          muted:        "#86868b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
