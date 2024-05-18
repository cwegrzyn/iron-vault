export function titleCase(str: string): string {
  return str.slice(0, 1).toUpperCase() + str.slice(1);
}

export function makeSafeForId(str: string): string {
  return str
    .replaceAll(/[^\w]+/g, "_")
    .replaceAll(/_{2,}/g, "_")
    .replaceAll(/^_|_$/g, "")
    .toLowerCase();
}
