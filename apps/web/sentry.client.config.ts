import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://534e8d3cc8c7bbdb4d6f8ea6a6daf6c3@o4511066175438848.ingest.de.sentry.io/4511066246742096",

  // Session Replay: 10% of sessions, 100% of sessions with errors
  integrations: [Sentry.replayIntegration()],

  // Performance Monitoring
  tracesSampleRate: 0.1,

  // Session Replay rates
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Set to false to disable in local dev (no DSN in local .env)
  enabled: process.env.NODE_ENV === "production",
});

