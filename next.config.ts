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
  /* config options here */
};

export default withNextIntl(nextConfig);
