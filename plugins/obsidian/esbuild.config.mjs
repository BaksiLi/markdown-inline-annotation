import { readFileSync } from "node:fs";
import esbuild from "esbuild";

const prod = process.argv.includes("--prod");
const entitiesLicense = readFileSync(new URL("../LICENSE", import.meta.resolve("entities")), "utf8").trim();

await esbuild.build({
  banner: {
    js: `/* Inline Annotation for Obsidian\n\nentities\n${entitiesLicense}\n*/`,
  },
  bundle: true,
  entryPoints: ["src/main.ts"],
  external: ["obsidian", "@codemirror/state", "@codemirror/view", "@codemirror/language"],
  format: "cjs",
  logLevel: "info",
  minify: prod,
  outfile: "main.js",
  sourcemap: prod ? false : "inline",
  target: "es2018",
  treeShaking: true,
});
