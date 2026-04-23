/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,html}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eceef1",
          200: "#d5d9e0",
          300: "#b0b7c3",
          400: "#808a9d",
          500: "#5a6479",
          600: "#414a5c",
          700: "#2f3646",
          800: "#1e2430",
          900: "#13171f",
          950: "#090b12",
        },
        accent: {
          50: "#fff1f4",
          100: "#ffe3ea",
          200: "#ffc6d4",
          300: "#ff98b2",
          400: "#ff5d83",
          500: "#ff2d66",
          600: "#ed0e4e",
          700: "#c8053f",
          800: "#a60a3a",
          900: "#8a0d36",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 12px 32px -12px rgba(16,24,40,.12)",
        glow: "0 0 0 1px rgba(255,45,102,.2), 0 12px 40px -8px rgba(255,45,102,.35)",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
