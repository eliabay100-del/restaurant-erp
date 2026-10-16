import { prisma } from '@/lib/prisma';
import { hashApiKey, generateApiKey } from '@/lib/integrations/secrets';

export { hashApiKey, generateApiKey };

export interface ResolvedApiKey {
  id: number;
  name: string;
  scopes: string[];
  revokedAt: Date | null;
}

export async function resolveApiKeyFromRequest(
  request: Request
): Promise<ResolvedApiKey | null> {
  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
  });
  if (!key || key.revokedAt) return null;

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined);

  return {
    id: key.id,
    name: key.name,
    scopes: key.scopes.split(',').map((s) => s.trim()).filter(Boolean),
    revokedAt: key.revokedAt,
  };
}

export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes('*');
}
