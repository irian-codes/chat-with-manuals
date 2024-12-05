export function truncateFilename(filename: string, maxLength = 255): string {
  return filename.length > maxLength
    ? filename.substring(0, maxLength - 3) + '...'
    : filename;
}
