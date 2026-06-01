import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070807",
          900: "#10120f",
          800: "#191d18",
          700: "#252b24"
        },
        paper: "#ece7d7",
        brass: "#caa45d",
        mint: "#72d6a2",
        ember: "#ff715b",
        cyan: "#75d6ff"
      },
      fontFamily: {
        sans: ["Avenir Next", "Avenir", "Segoe UI", "system-ui", "sans-serif"],
        serif: ["Avenir Next", "Avenir", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["SFMono-Regular", "Menlo", "Monaco", "Consolas", "ui-monospace", "monospace"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(202, 164, 93, 0.18), 0 24px 80px rgba(0, 0, 0, 0.36)"
      }
    }
  },
  plugins: []
};

export default config;
