const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

/**
 * Resolves backend API URL cleanly for both full-stack Node hosting (same-origin)
 * and split static hosting (e.g., Netlify/Vercel frontend + external Node backend).
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return rawApiBase ? `${rawApiBase}${normalizedPath}` : normalizedPath;
}
