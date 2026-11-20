import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { run } from "../../../scripts/lib.mjs";
import { syncPackageSpec } from "../../../scripts/spec.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const tsc = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));

syncPackageSpec();
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });

run(process.execPath, [tsc, "--module", "commonjs"], { cwd });

// The playground and SilverBullet load core.mjs as a standalone browser module.
await build({
  absWorkingDir: cwd,
  entryPoints: ["src/core.ts", "src/dom.ts", "src/index.ts"],
  bundle: true,
  format: "esm",
  target: "es2020",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
});
