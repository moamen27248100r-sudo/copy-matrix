// Builds the Supabase Auth email templates (sign-up confirmation, password
// reset) in all 13 languages from src/messages/*.json (namespace AuthEmail).
// The template picks the language from the user's metadata ({{ .Data.locale }},
// set at sign-up and when they switch language), Arabic when it's missing.
//
//   node scripts/build-auth-email-templates.mjs
//
// Writes supabase/templates/confirmation.html and recovery.html, to paste
// into Supabase Dashboard -> Authentication -> Emails (see docs/email-setup.md).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOCALES = ["ar", "en", "fr", "es", "pt", "zh", "hi", "ur", "id", "vi", "th", "bn", "sw"];
const RTL = new Set(["ar", "ur"]);
const root = process.cwd();
const m = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(readFileSync(join(root, "src/messages", `${l}.json`), "utf8")).AuthEmail]));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function block(locale, kind) {
  const t = m[locale];
  const dir = RTL.has(locale) ? "rtl" : "ltr";
  const align = dir === "rtl" ? "right" : "left";
  const button = (label) =>
    `<a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2f6fed;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">${esc(label)}</a>`;
  const inner =
    kind === "confirmation"
      ? `<h1 style="margin:0 0 12px;font-size:20px;color:#1a2234;">${esc(t.confirmSubject)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2b3446;">${esc(t.confirmBody)}</p>
<p style="margin:0 0 20px;">${button(t.confirmButton)}</p>`
      : `<h1 style="margin:0 0 12px;font-size:20px;color:#1a2234;">${esc(t.resetSubject)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#2b3446;">${esc(t.resetBody)}</p>
<p style="margin:0 0 20px;font-size:28px;font-weight:700;letter-spacing:6px;color:#1a2234;" dir="ltr">{{ .Token }}</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#5b6475;">${esc(t.resetLinkNote)}</p>
<p style="margin:0 0 20px;">${button(t.resetButton)}</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;" dir="${dir}">
<tr><td style="background:#0b0f17;padding:18px 24px;text-align:${align};"><span style="font-size:18px;font-weight:700;color:#ffffff;">Copy Matrix</span></td></tr>
<tr><td style="padding:28px 24px 12px;text-align:${align};">
${inner}
<p style="margin:0 0 6px;font-size:12px;color:#7a8396;">${esc(t.linkFallback)}</p>
<p style="margin:0 0 16px;font-size:12px;word-break:break-all;" dir="ltr"><a href="{{ .ConfirmationURL }}" style="color:#2f6fed;">{{ .ConfirmationURL }}</a></p>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e6e9f0;text-align:${align};font-size:12px;line-height:1.6;color:#7a8396;">${esc(t.ignoreNote)}</td></tr>
</table>`;
}

function template(kind) {
  const branches = LOCALES.filter((l) => l !== "ar")
    .map((l, i) => `{{ ${i === 0 ? "if" : "else if"} eq $l "${l}" }}\n${block(l, kind)}\n`)
    .join("");
  return `{{ $l := or .Data.locale "ar" }}<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f4f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f8;padding:24px 12px;"><tr><td align="center">
${branches}{{ else }}
${block("ar", kind)}
{{ end }}
</td></tr></table>
</body>
</html>
`;
}

const outDir = join(root, "supabase/templates");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "confirmation.html"), template("confirmation"));
writeFileSync(join(outDir, "recovery.html"), template("recovery"));
const subjects = (key) => LOCALES.map((l) => `${l}: ${m[l][key]}`).join("\n");
writeFileSync(
  join(outDir, "subjects.txt"),
  `Subject lines (Supabase subjects can't switch language; use the bilingual one):\n\nConfirm signup: ${m.ar.confirmSubject} | ${m.en.confirmSubject}\nReset password: ${m.ar.resetSubject} | ${m.en.resetSubject}\n\nAll languages, for reference:\n\n${subjects("confirmSubject")}\n\n${subjects("resetSubject")}\n`,
);
console.log("wrote supabase/templates/confirmation.html, recovery.html, subjects.txt");
