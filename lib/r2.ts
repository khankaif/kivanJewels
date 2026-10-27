import { AwsClient } from 'aws4fetch';

/**
 * Cloudflare R2, spoken to over its S3 API.
 *
 * Photos never pass through this server: Vercel caps a request body at 4.5 MB
 * and a jewellery photo is often bigger. The server signs a short-lived PUT and
 * the browser uploads straight to the bucket.
 */

/** Keys this app writes. Anything else arriving in a form is refused, not stored. */
export const IMAGE_KEY = /^catalog\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
};
export const IMAGE_TYPES = Object.keys(EXT);

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set. See .env.local.example.`);
  return v;
}

let client: AwsClient | null = null;
const r2 = () => (client ??= new AwsClient({
  accessKeyId: env('R2_ACCESS_KEY_ID'),
  secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  service: 's3',
  region: 'auto',
}));

const objectUrl = (key: string) =>
  new URL(`https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}/${key}`);

/** A fresh key and a URL the browser may PUT that one file to for ten minutes. */
export async function presignUpload(contentType: string): Promise<{ key: string; url: string }> {
  const ext = EXT[contentType];
  if (!ext) throw new Error(`not an image type we accept: ${contentType}`);
  const key = `catalog/${crypto.randomUUID()}.${ext}`;
  const url = objectUrl(key);
  url.searchParams.set('X-Amz-Expires', '600');
  // ponytail: the signature does not pin the file size; uploads are staff-only
  // and capped in the browser. Switch to a presigned POST policy with
  // content-length-range if uploads ever open to the public.
  const signed = await r2().sign(new Request(url, { method: 'PUT' }), { aws: { signQuery: true } });
  return { key, url: signed.url };
}

/**
 * Best effort. Runs after the row is saved, so a failure here leaves an
 * orphaned file in the bucket, never a row pointing at a missing photo.
 */
export async function removeImages(keys: string[]): Promise<void> {
  await Promise.all(keys.filter((k) => IMAGE_KEY.test(k)).map(async (k) => {
    try {
      const res = await r2().fetch(objectUrl(k), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) console.error(`R2 delete ${k}: ${res.status}`);
    } catch (e) {
      console.error(`R2 delete ${k}:`, e);
    }
  }));
}

/**
 * Where the bucket is served publicly, without a trailing slash. Null until R2
 * is configured, so pages render without photos instead of crashing.
 */
export const imageBase = () => process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || null;
