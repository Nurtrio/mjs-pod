import { google } from 'googleapis';

function getGmailAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  return oauth2Client;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!process.env.GMAIL_REFRESH_TOKEN) {
    throw new Error('GMAIL_REFRESH_TOKEN not configured — visit /api/auth/gmail to authorize');
  }

  const auth = getGmailAuth();
  const gmail = google.gmail({ version: 'v1', auth });

  const fromAddress = process.env.GMAIL_USER || 'Tommy@mobilejanitorialsupply.com';

  // Build RFC 2822 email
  const rawEmail = [
    `From: "Mobile Janitorial Supply" <${fromAddress}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');

  // Base64url encode
  const encodedMessage = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return res.data;
}
