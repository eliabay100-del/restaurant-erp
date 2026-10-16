import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Serves files that are uploaded at runtime (e.g. menu images).
 * They live outside `public/` because Next.js only serves files that were
 * present in `public/` at build time.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  const target = path.normalize(path.join(UPLOAD_ROOT, ...segments));
  // Prevent path traversal outside the uploads directory.
  if (target !== UPLOAD_ROOT && !target.startsWith(UPLOAD_ROOT + path.sep)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
