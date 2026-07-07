// Sentry error tracking — enabled only when SENTRY_DSN is set.
import * as Sentry from "@sentry/node";
import type { Express, Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const dsn = process.env["SENTRY_DSN"];

export const sentryEnabled = Boolean(dsn);

export function initSentry(): void {
  if (!dsn) {
    logger.info("SENTRY_DSN not set; Sentry disabled");
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env["NODE_ENV"] ?? "development",
    tracesSampleRate: 0,
    // Never send request bodies or cookies — CVs and sessions are sensitive.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers["cookie"];
          delete event.request.headers["authorization"];
        }
      }
      logger.info(
        { eventId: event.event_id, tags: event.tags },
        "Sentry event captured",
      );
      return event;
    },
  });
  logger.info("Sentry initialized");
}

/** Tag events with tenant/user context (no email/PII beyond user id). */
export function sentryContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (sentryEnabled && req.auth) {
    Sentry.setUser({ id: req.auth.userId });
    Sentry.setTag("tenant", req.auth.tenantSlug);
    Sentry.setTag("role", req.auth.role);
  }
  next();
}

export function setupSentryErrorHandler(app: Express): void {
  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }
}
