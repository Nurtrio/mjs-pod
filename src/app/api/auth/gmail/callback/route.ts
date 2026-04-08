import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:-apple-system,sans-serif;padding:60px;text-align:center;">
        <h1 style="color:#ff3b30;">Authorization Failed</h1>
        <p>${error}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  if (!code) {
    return new NextResponse(
      `<html><body style="font-family:-apple-system,sans-serif;padding:60px;text-align:center;">
        <h1 style="color:#ff3b30;">No auth code received</h1>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/callback`,
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Display tokens so they can be saved as env vars
    return new NextResponse(
      `<html>
      <body style="font-family:-apple-system,sans-serif;padding:40px;max-width:700px;margin:0 auto;">
        <div style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:16px;padding:24px;text-align:center;margin-bottom:32px;">
          <p style="font-size:32px;margin:0;">✓</p>
          <h1 style="color:#34c759;margin:8px 0 0;font-size:24px;">Gmail Authorized!</h1>
          <p style="color:#666;margin:8px 0 0;font-size:14px;">Tommy@mobilejanitorialsupply.com is connected</p>
        </div>

        <h2 style="font-size:18px;color:#1a1a1a;">Save this refresh token as an env var:</h2>

        <div style="background:#1a1a2e;border-radius:12px;padding:20px;margin:16px 0;">
          <p style="color:#888;font-size:12px;margin:0 0 8px;font-weight:600;">GMAIL_REFRESH_TOKEN</p>
          <code style="color:#4ade80;font-size:13px;word-break:break-all;line-height:1.6;">${tokens.refresh_token || 'No refresh token — you may already have one saved'}</code>
        </div>

        ${tokens.access_token ? `
        <div style="background:#f5f5f7;border-radius:12px;padding:20px;margin:16px 0;">
          <p style="color:#888;font-size:12px;margin:0 0 8px;font-weight:600;">Access Token (temporary, for reference)</p>
          <code style="color:#333;font-size:11px;word-break:break-all;line-height:1.4;">${tokens.access_token}</code>
        </div>` : ''}

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-top:24px;">
          <p style="margin:0;font-size:14px;color:#c2410c;font-weight:600;">Next step:</p>
          <p style="margin:6px 0 0;font-size:13px;color:#666;">Add <code>GMAIL_REFRESH_TOKEN</code> to your Vercel environment variables, then you're all set.</p>
        </div>
      </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  } catch (err) {
    return new NextResponse(
      `<html><body style="font-family:-apple-system,sans-serif;padding:60px;text-align:center;">
        <h1 style="color:#ff3b30;">Token Exchange Failed</h1>
        <p style="color:#666;">${err instanceof Error ? err.message : 'Unknown error'}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }
}
