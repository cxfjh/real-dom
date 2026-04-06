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
        minify: true,
        lib: {
            entry: resolve("src/index.ts"),
            name: "wwr",
            fileName: () => "0.0.1.js",
            formats: ["umd"],
        },
        rollupOptions: {
            treeshake: true,
            output: { comments: false, },
        },
    },
});
