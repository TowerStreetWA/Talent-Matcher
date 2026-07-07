// PostHog analytics — enabled only when VITE_PUBLIC_POSTHOG_KEY is set.
import posthog from "posthog-js";

const key =
  (import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined) ??
  (import.meta.env.VITE_POSTHOG_KEY as string | undefined);
const host =
  (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ??
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  "https://us.i.posthog.com";

export const analyticsEnabled = Boolean(key);

if (key) {
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    autocapture: false,
    persistence: "localStorage",
  });
}

export function identifyUser(
  userId: string,
  props: { tenant: string; role: string },
): void {
  if (!analyticsEnabled) return;
  posthog.identify(userId, props);
  posthog.group("tenant", props.tenant);
}

export function resetAnalytics(): void {
  if (!analyticsEnabled) return;
  posthog.reset();
}

export function track(
  event: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (!analyticsEnabled) return;
  posthog.capture(event, props);
}
