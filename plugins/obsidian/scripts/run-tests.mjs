import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import esbuild from "esbuild";
import { run } from "../../../scripts/lib.mjs";

const outdir = mkdtempSync(join(tmpdir(), "inline-annotation-obsidian-tests-"));
const suites = ["postprocessor.test", "live-preview-ranges.test"];

try {
  await esbuild.build({
    bundle: true,
    entryPoints: suites.map((suite) => `test/${suite}.ts`),
    format: "cjs",
    outdir,
    outExtension: { ".js": ".cjs" },
    platform: "node",
    target: "node22",
  });

  run(process.execPath, ["--test", ...suites.map((suite) => join(outdir, `${suite}.cjs`))], { cwd: process.cwd() });
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
