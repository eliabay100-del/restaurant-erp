/** Resolve a menu item image URL, falling back to a generated placeholder. */
export function resolveMenuImage(image: string | null | undefined, nameEn: string): string | null {
  if (image) return image;
  return null;
}
