import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data: l } = await admin.auth.admin.generateLink({ type: "magiclink", email: "mo48100r@gmail.com" });
const { data: s } = await anon.auth.verifyOtp({ token_hash: l.properties.hashed_token, type: "magiclink" });
const ref = new URL(url).hostname.split(".")[0];
const val = "base64-" + Buffer.from(JSON.stringify(s.session)).toString("base64url");
const name = `sb-${ref}-auth-token`;
const parts = []; for (let i = 0; i * 3180 < val.length; i++) parts.push(`${name}.${i}=${val.slice(i * 3180, (i + 1) * 3180)}`);
const cookie = parts.join("; ") + "; locale=en";
const target = process.argv[2] || "https://copy-matrix.vercel.app/dashboard";
const times = [];
for (let i = 0; i < 6; i++) {
  const t0 = performance.now();
  const r = await fetch(target, { headers: { cookie }, redirect: "manual" });
  await r.text();
  times.push(Math.round(performance.now() - t0));
}
console.log("status ok; ms per request:", times.join(", "), "median:", [...times].sort((a, b) => a - b)[3]);
