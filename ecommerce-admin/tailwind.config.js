/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14213D",
          light: "#1E2E52",
          dark: "#0D1730",
        },
        canvas: "#F5F6F8",
        surface: "#FFFFFF",
        accent: {
          DEFAULT: "#2F6F4E",
          light: "#3D8A63",
          dark: "#23533B",
        },
        alert: {
          DEFAULT: "#B3432B",
          light: "#C65D40",
        },
        ink2: "#1B1F27",
        muted: "#6B7280",
        hairline: "#E2E4E9",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
