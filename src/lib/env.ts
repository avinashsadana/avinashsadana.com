/**
 * Reads a server-side environment variable.
 *
 * On Vercel these live in `process.env`. In local development Astro loads
 * `.env.local` into `import.meta.env` instead, and does not populate
 * `process.env`. Checking both means the same code path works in dev and in
 * production without a separate configuration story for each.
 */
export function env(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;

  const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[name];
  return fromImportMeta || undefined;
}
