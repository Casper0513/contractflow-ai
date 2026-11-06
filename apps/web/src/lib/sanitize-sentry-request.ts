export function sanitizeSentryRequestPath(path: string): string {
  const [pathname] = path.split("?", 1);

  return pathname.replace(/^\/(e|i)\/[^/?#]+/, "/$1/:token");
}
