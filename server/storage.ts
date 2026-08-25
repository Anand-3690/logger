import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function uploadPhotoFile(file: Express.Multer.File): Promise<string> {
  // Fallback storage: save to uploads folder or return data URL
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  fs.writeFileSync(filePath, file.buffer);
  
  // Return the public route URL served by Express
  return `/uploads/${filename}`;
}

export async function uploadBase64Photo(base64Data: string): Promise<string> {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    // If it's already an HTTP URL, return as-is
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      return base64Data;
    }
    return base64Data;
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  let ext = '.jpg';
  if (mimeType.includes('png')) ext = '.png';
  if (mimeType.includes('webp')) ext = '.webp';
  if (mimeType.includes('gif')) ext = '.gif';

  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/${filename}`;
}
