export function sanitizeRequestPath(
  originalUrl: string,
  fallbackPath: string,
): string {
  const path = originalUrl.split('?', 1)[0] || fallbackPath;

  return path.replace(
    /\/api\/public\/(estimates|invoices)\/[^/]+/g,
    '/api/public/$1/:token',
  );
}
