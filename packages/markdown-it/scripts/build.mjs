import { rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { run } from "../../../scripts/lib.mjs";
import { syncPackageSpec } from "../../../scripts/spec.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const tsc = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));

syncPackageSpec();
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });

run(process.execPath, [tsc, "--module", "commonjs"], { cwd });
run(process.execPath, [tsc, "--outDir", "dist/esm", "--declaration", "false"], { cwd });

writeFileSync(new URL("../dist/esm/package.json", import.meta.url), '{"type":"module"}\n');
// Preserve the original entry filenames, including the playground's browser import.
for (const entry of ["core", "dom", "index"]) {
  const defaultExport = entry === "index" ? 'export { default } from "./esm/index.js";\n' : "";
  writeFileSync(new URL(`../dist/${entry}.mjs`, import.meta.url), `export * from "./esm/${entry}.js";\n${defaultExport}`);
}
