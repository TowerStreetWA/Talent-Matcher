// Bootstrap: Sentry must initialize before Express and other modules load,
// so the rest of the server is loaded via dynamic import after init.
import { initSentry } from "./lib/sentry";

initSentry();

await import("./start");
