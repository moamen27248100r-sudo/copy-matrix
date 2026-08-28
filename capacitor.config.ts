import type { CapacitorConfig } from '@capacitor/cli';

// Copy Matrix is a fully server-rendered Next.js app (SSR, cookies,
// server actions) — it can't be statically exported into the app
// bundle. Instead the native shell just points its WebView at the
// live deployment, the same approach used by most "wrap an existing
// web app" Capacitor projects.
const config: CapacitorConfig = {
  appId: 'com.copymatrix.app',
  appName: 'Copy Matrix',
  webDir: 'public',
  server: {
    url: 'https://copy-matrix.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0b0f19',
  },
};

export default config;
