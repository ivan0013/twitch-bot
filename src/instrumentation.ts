import type { Instrumentation } from 'next';

// Next.js 15 server request errors. Do not forward headers, full URLs or bodies.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  // The PostHog Node SDK is not supported in Edge; Vercel runtime logs remain available.
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME === 'edge' || !token || !host) return;

  try {
    const { PostHog } = await import('posthog-node');
    const client = new PostHog(token, { host, flushAt: 1, flushInterval: 0 });
    client.captureException(error, 'twitch-bot-server', {
      mvp_slug: 'twitch-bot',
      route: context.routePath,
      route_type: context.routeType,
      request_method: request.method,
    });
    await client.shutdown();
  } catch {
    // Monitoring failures must never mask the application's original error.
  }
};
