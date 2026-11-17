import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { root } from "./lib.mjs";

export function syncPackageSpec() {
  for (const name of ["SPEC.md", "fixtures", "docs"]) {
    cpSync(resolve(root, name), resolve(root, "packages/markdown-it", name), { recursive: true });
  }
}
