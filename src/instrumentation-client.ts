import posthog from 'posthog-js';

// Optional observability for production MVPs. No credentials or cookies are required to boot.
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (process.env.NODE_ENV === 'production' && token && host) {
  try {
    posthog.init(token, {
      api_host: host,
      defaults: '2026-05-30',
      capture_exceptions: true,
      // Error monitoring only by default: do not collect behavioral analytics or replay.
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      persistence: 'memory',
      person_profiles: 'identified_only',
    });
    posthog.register({ mvp_slug: 'twitch-bot' });
  } catch {
    // Telemetry must never prevent an MVP from starting.
  }
}
