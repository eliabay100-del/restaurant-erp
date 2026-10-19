import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MANAGEMENT_ROLES } from '@/lib/roles';
import { getBackupPath } from '@/lib/integrations/backup';
import fs from 'fs';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await getSession();
  if (!session || !MANAGEMENT_ROLES.includes(session.role as 'ADMIN' | 'MANAGER')) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 401 });
  }
  const { filename } = await params;
  const full = getBackupPath(filename);
  if (!full) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const stat = fs.statSync(full);
  const stream = fs.createReadStream(full);
  return new NextResponse(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(stat.size),
    },
  });
}