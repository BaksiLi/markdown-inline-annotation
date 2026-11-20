import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";
import logseqDevPlugin from "vite-plugin-logseq";

const require = createRequire(import.meta.url);
const sdkNotice = "lsplugin.user.js.LICENSE.txt";

export default defineConfig({
  plugins: [logseqDevPlugin(), {
    name: "logseq-sdk-notice",
    apply: "build",
    generateBundle() {
      const sdkDirectory = dirname(require.resolve("@logseq/libs"));
      this.emitFile({
        type: "asset",
        fileName: `assets/${sdkNotice}`,
        source: readFileSync(join(sdkDirectory, sdkNotice)),
      });
    },
  }],
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
