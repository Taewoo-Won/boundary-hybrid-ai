import { existsSync } from "node:fs";
import { defineConfig } from "vite";
// Pages: the app (index.html) and the on-device boundary eval (eval.html).
const pages = ["index.html", "eval.html"].filter((p) => existsSync(p));
export default defineConfig({ build: { rollupOptions: { input: pages } } });
