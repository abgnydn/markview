import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://534e8d3cc8c7bbdb4d6f8ea6a6daf6c3@o4511066175438848.ingest.de.sentry.io/4511066246742096",
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});

