/**
 * Logger — no-op in production builds, console.log in dev.
 *
 * Replaces ad-hoc console.log calls. Use `log.debug` for breadcrumbs,
 * `log.warn` for recoverable issues, `log.error` for failures. Errors are
 * always logged regardless of environment.
 */

const isProd = process.env.NODE_ENV === 'production';

export const log = {
  debug: isProd ? () => {} : (...args: unknown[]) => console.log(...args),
  info: isProd ? () => {} : (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
