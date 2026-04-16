import { defineConfig } from "vite";
// @ts-ignore
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [
        dts({ outDir: "dist", entryRoot: "src" }),
    ],

    build: {
        target: "esnext",
        minify: "terser",
        lib: {
            entry: resolve("src/index.ts"),
            fileName: (format) => {
                if (format === "es") return "es.0.0.1.js";
                return "0.0.1.js";
            },
            name: "RealDom",
            formats: ["es", "iife"]
        }
    },
});
