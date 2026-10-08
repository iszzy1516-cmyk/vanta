/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#1C1B19",
        surface: "#242320",
        bone: "#EDEAE2",
        mist: "#9A958A",
        amber: "#E8A33D",
        hairline: "#3A382F",
      },
      fontFamily: {
        grotesk: ["var(--font-grotesk)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
