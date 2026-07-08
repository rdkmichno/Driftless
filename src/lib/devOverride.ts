/**
 * Dev-only mission-length override: append ?t=<minutes> to the URL in a dev
 * build to shorten preset missions for testing (e.g. ?t=0.5 → 30 s). Never
 * applied to custom sessions, and inert in production builds.
 */
export const devMinutes = import.meta.env.DEV
  ? Number(new URLSearchParams(location.search).get('t')) || null
  : null;
