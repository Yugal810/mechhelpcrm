import nodemailer from 'nodemailer';

export async function sendDailyQuicksEmail(subject, text, html) {
  const host = process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT?.trim() || 587);
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASSWORD?.replace(/\s+/g, '').trim();
  const from = process.env.EMAIL_FROM?.trim();
  const to = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();

  if (!host || !user || !pass || !from || !to) {
    throw new Error(
      'Email env vars required: EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM, ADMIN_NOTIFICATION_EMAIL'
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}
