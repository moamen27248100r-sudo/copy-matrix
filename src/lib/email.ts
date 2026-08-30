import nodemailer from "nodemailer";

// SUPPORT_EMAIL_* isn't set until a real support mailbox is purchased for
// the broker. Until then this is a safe no-op — nothing sends, nothing
// throws — so the follow feature can ship now and start delivering the
// moment those env vars are added.
export async function sendSupportEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const { SUPPORT_EMAIL_HOST, SUPPORT_EMAIL_PORT, SUPPORT_EMAIL_USER, SUPPORT_EMAIL_PASS, SUPPORT_EMAIL_FROM } =
    process.env;

  if (!SUPPORT_EMAIL_HOST || !SUPPORT_EMAIL_USER || !SUPPORT_EMAIL_PASS) {
    console.log(`[email] SUPPORT_EMAIL_* not configured — skipped "${subject}" to ${to}`);
    return;
  }

  const port = Number(SUPPORT_EMAIL_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: SUPPORT_EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: SUPPORT_EMAIL_USER, pass: SUPPORT_EMAIL_PASS },
  });

  await transporter.sendMail({
    from: SUPPORT_EMAIL_FROM || SUPPORT_EMAIL_USER,
    to,
    subject,
    html,
  });
}
