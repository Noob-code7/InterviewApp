import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || "us-east-1";
const CDN_URL = process.env.CDN_URL || "";
const SIGNED_URL_EXPIRY = parseInt(
  process.env.SIGNED_URL_EXPIRY || "86400",
  10,
);

const isPlaceholder = (val) => !val || val.includes("your-") || val.includes("<YOUR_");
const useS3 = BUCKET && !isPlaceholder(BUCKET) && !isPlaceholder(process.env.AWS_ACCESS_KEY_ID);

const s3 = useS3 ? new S3Client({ region: REGION }) : null;

export async function uploadBuffer(
  buffer,
  key,
  contentType = "application/octet-stream",
) {
  // If S3 is validly configured, attempt upload to S3 / Cloudflare R2
  if (useS3 && s3) {
    try {
      const cmd = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await s3.send(cmd);

      if (CDN_URL) {
        return { key, url: `${CDN_URL.replace(/\/$/, "")}/${key}` };
      }

      const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
      const url = await getSignedUrl(s3, getCmd, { expiresIn: SIGNED_URL_EXPIRY });
      return { key, url };
    } catch (err) {
      console.warn("[Storage] S3 upload failed, falling back to local disk storage:", err.message);
    }
  }

  // Fallback for local disk storage
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");
  const filePath = path.join(uploadsDir, key);
  const fileDir = path.dirname(filePath);

  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  await fs.promises.writeFile(filePath, buffer);
  const relativeKey = key.replace(/\\/g, "/");
  const localUrl = `/uploads/${relativeKey}`;
  return { key: relativeKey, url: localUrl };
}

export function makeKeyForAnswer(sessionId, filename) {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `answers/${sessionId}/${Date.now()}-${safeName}`;
}

export default { uploadBuffer, makeKeyForAnswer };
