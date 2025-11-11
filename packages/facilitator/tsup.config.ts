import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: {
    resolve: true,
    compilerOptions: {
      skipLibCheck: true,
    },
  },
  tsconfig: "./tsconfig.json",
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});

