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
          950: "rgb(var(--color-ink-950) / <alpha-value>)",
          900: "rgb(var(--color-ink-900) / <alpha-value>)",
          800: "rgb(var(--color-ink-800) / <alpha-value>)",
          700: "rgb(var(--color-ink-700) / <alpha-value>)"
        },
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        brass: "rgb(var(--color-accent) / <alpha-value>)",
        mint: "#72d6a2",
        ember: "#ff715b",
        cyan: "#75d6ff"
      },
      fontFamily: {
        // Keep utility classes in sync with the runtime app-font preference.
        // A hard-coded Tailwind stack was why a font change only affected
        // body copy while navigation and controls stayed unchanged.
        sans: ["var(--font-app)"],
        serif: ["var(--font-app)"],
        mono: ["var(--font-interface)"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--color-accent) / 0.18), 0 24px 80px rgb(0 0 0 / 0.36)"
      }
    }
  },
  plugins: []
};

export default config;
