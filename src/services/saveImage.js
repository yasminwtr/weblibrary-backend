import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function saveImage(part) {
  const uploadDir = path.join(__dirname, '..', 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const timestamp = Date.now();
  const safeFilename = part.filename.replace(/\s+/g, '-');
  const filename = `${timestamp}-${safeFilename}`;
  const filepath = path.join(uploadDir, filename);

  await pipeline(part.file, fs.createWriteStream(filepath));

  return `/uploads/${filename}`;
}
