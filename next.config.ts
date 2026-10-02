import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Some launchers invoke `next dev <projectDir>` without setting the
// process's actual working directory to <projectDir>, which breaks any
// plugin (like next-intl) that resolves paths relative to process.cwd().
// Force it here so relative path resolution always works regardless of
// how this process was spawned.
const configDir = path.dirname(fileURLToPath(import.meta.url));
if (process.cwd() !== configDir) {
  process.chdir(configDir);
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray package-lock.json higher up
  // the tree otherwise triggers a warning on every build).
  turbopack: { root: configDir },
  // Leader avatars are capped at 1 MB; the default 1 MB action body limit
  // would reject a file near that size once multipart overhead is added.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Shown at the bottom of the account menu.
  env: {
    NEXT_PUBLIC_APP_VERSION: (JSON.parse(readFileSync(path.join(configDir, "package.json"), "utf8")) as { version: string }).version,
  },
};

export default withNextIntl(nextConfig);
