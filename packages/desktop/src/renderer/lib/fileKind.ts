const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"]);
const HTML_EXT = new Set(["html", "htm"]);

export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

export function isImageFile(filename: string): boolean {
  return IMAGE_EXT.has(extOf(filename));
}

export function isHtmlFile(filename: string): boolean {
  return HTML_EXT.has(extOf(filename));
}

// "Design" = the kinds of files worth showing as a visual frame on a
// Figma-style canvas — images and rendered HTML mockups.
export function isDesignFile(filename: string): boolean {
  return isImageFile(filename) || isHtmlFile(filename);
}
