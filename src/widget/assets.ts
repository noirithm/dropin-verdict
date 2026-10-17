let base = "/";
export function setAssetBase(b: string): void {
  base = b.endsWith("/") ? b : `${b}/`;
}
export const assetUrl = (path: string): string => base + path;
