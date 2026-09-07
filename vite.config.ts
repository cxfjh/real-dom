import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dts from "vite-plugin-dts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    resolve: { tsconfigPaths: true },
    plugins: [dts({ entryRoot: "src", insertTypesEntry: true })],
    build: {
        target: "esnext",
        emptyOutDir: true,
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            fileName: (format) => {
                const version = "0.1.0";
                if (format === "es") return `es.${ version }.js`;
                return `${ version }.js`;
            },
            name: "RealDom",
            formats: ["es", "iife"],
        },
        rolldownOptions: { output: { exports: "default" } },
    },
});
