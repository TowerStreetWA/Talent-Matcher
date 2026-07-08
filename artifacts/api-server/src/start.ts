import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty, ensureAuthSeed } from "./lib/seed";
import { startSavedSearchAlertSweep } from "./lib/savedSearchAlerts";
import { startExpirySweep } from "./lib/vacancies/expirySweep";
import { getStripeSync } from "./lib/stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedIfEmpty()
  .then(() => ensureAuthSeed())
  .catch((err) => {
    logger.error({ err }, "Seeding failed");
  });

async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe integration");
  }

  logger.info("Initializing Stripe schema...");
  await runMigrations({ databaseUrl });

  const stripeSync = await getStripeSync();

  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) {
    const webhook = await stripeSync.findOrCreateManagedWebhook(
      `https://${domain}/api/stripe/webhook`,
    );
    logger.info({ url: webhook.url }, "Stripe managed webhook configured");
  } else {
    logger.warn("REPLIT_DOMAINS not set; skipping managed webhook setup");
  }

  stripeSync
    .syncBackfill({ object: "all" })
    .then(() => logger.info("Stripe data backfill complete"))
    .catch((err) => logger.error({ err }, "Stripe data backfill failed"));
}

initStripe().catch((err) => {
  logger.error(
    { err },
    "Stripe initialization failed — billing features will be unavailable",
  );
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startSavedSearchAlertSweep();
  startExpirySweep();
});
