import { google } from 'googleapis';
import { Readable } from 'stream';

function getAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });
  return oauth2Client;
}

/** Ensure a subfolder exists for the given date, return its ID */
async function getOrCreateDateFolder(drive: ReturnType<typeof google.drive>, date: string): Promise<string> {
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  // Check if folder exists
  const res = await drive.files.list({
    q: `name='${date}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: date,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return folder.data.id!;
}

/** Upload a POD PDF to Google Drive */
export async function uploadPodToDrive(
  pdfBuffer: Buffer,
  invoiceNumber: string,
  _driverName: string,
  date: string
): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const folderId = await getOrCreateDateFolder(drive, date);
  const fileName = `${invoiceNumber}.pdf`;

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer),
    },
    fields: 'id',
  });

  return file.data.id!;
}
