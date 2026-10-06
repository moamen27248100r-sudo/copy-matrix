import nodemailer from "nodemailer";

// Outgoing email over SMTP. Works with any provider that offers SMTP (Resend,
// Brevo, the host's mailbox...): set SUPPORT_EMAIL_HOST / _PORT / _USER /
// _PASS / _FROM. Until those are set this is a safe no-op -- nothing sends,
// nothing throws -- and everything starts delivering once they are added.

export function emailConfigured() {
  const { SUPPORT_EMAIL_HOST, SUPPORT_EMAIL_USER, SUPPORT_EMAIL_PASS } = process.env;
  return !!(SUPPORT_EMAIL_HOST && SUPPORT_EMAIL_USER && SUPPORT_EMAIL_PASS);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SUPPORT_EMAIL_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: process.env.SUPPORT_EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SUPPORT_EMAIL_USER, pass: process.env.SUPPORT_EMAIL_PASS },
  });
  return transporter;
}

export async function sendMail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  if (!emailConfigured()) {
    console.log(`[email] SUPPORT_EMAIL_* not configured — skipped "${subject}" to ${to}`);
    return false;
  }
  await getTransporter().sendMail({
    from: process.env.SUPPORT_EMAIL_FROM || process.env.SUPPORT_EMAIL_USER,
    to,
    subject,
    html,
    text,
  });
  return true;
}

export async function sendSupportEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  await sendMail({ to, subject, html });
}
