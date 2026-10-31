/** Resolve a menu item image URL. Warka has no curated image fallbacks, so
 *  this just returns the stored upload (or null). */
export function resolveMenuImage(image: string | null | undefined, nameEn: string): string | null {
  const stored = image?.trim();
  return stored ? stored : null;
}

export function normalizeMenuName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function resolveMenuDescription(
  nameEn: string,
  descEn: string | null | undefined,
  descAm: string | null | undefined,
  locale: string,
  categoryNameEn?: string | null,
): string {
  if (locale === 'am') {
    if (descAm?.trim()) return descAm.trim();
    if (descEn?.trim()) return descEn.trim();
    return '';
  }
  if (descEn?.trim()) return descEn.trim();
  return '';
}

export function resolveCategoryTagline(nameEn: string, locale: string): string {
  return '';
}

export function menuArtGradient(name: string): string {
  return 'linear-gradient(145deg, hsl(24 34% 14%), hsl(32 42% 8%) 60%, #060504)';
}
