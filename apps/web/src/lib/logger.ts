/**
 * Logger — no-op in production builds, console in dev.
 *
 * Replaces ad-hoc console.log calls. Use `log.debug` for breadcrumbs,
 * `log.warn` for recoverable issues, `log.error` for failures. Errors are
 * always logged regardless of environment.
 */

type LogFn = (...args: unknown[]) => void;

const isProd = process.env.NODE_ENV === 'production';
const noop: LogFn = () => {};

/* eslint-disable no-console */
export const log: { debug: LogFn; info: LogFn; warn: LogFn; error: LogFn } = {
  debug: isProd ? noop : (...args) => console.log(...args),
  info: isProd ? noop : (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
/* eslint-enable no-console */
