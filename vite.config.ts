import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteMotionOptimize } from "@humanspeak/svelte-motion/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [svelteMotionOptimize(), svelte(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      $lib: path.resolve(__dirname, "./src/shared"),
    },
  },
  worker: {
    format: "es",
  },
  build: {
    target: "esnext", // Modern browsers / Tauri webview only
    minify: "terser",
    sourcemap: false,
    cssCodeSplit: true,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
