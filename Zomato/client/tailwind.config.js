export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                accent: {
                    DEFAULT: "#8b1e24",
                    deep: "#651318",
                    soft: "#b7424a",
                    blush: "#f2d4d1",
                },
                cream: {
                    DEFAULT: "#f7f2eb",
                    soft: "#fbf8f4",
                    rich: "#efe6da",
                },
                ink: {
                    DEFAULT: "#241715",
                    soft: "#5e4d49",
                    muted: "#8e7d77",
                },
            },
            fontFamily: {
                sans: ["Manrope", "sans-serif"],
                display: ["Cormorant Garamond", "serif"],
            },
            boxShadow: {
                soft: "0 18px 40px -24px rgba(46, 20, 17, 0.35)",
                card: "0 24px 60px -30px rgba(57, 23, 18, 0.28)",
            },
            backgroundImage: {
                velvet: "radial-gradient(circle at top, rgba(139,30,36,0.18), transparent 48%), linear-gradient(180deg, #fffdf9 0%, #f7f2eb 100%)",
            },
            borderRadius: {
                "4xl": "2rem",
            },
        },
    },
    plugins: [],
};
