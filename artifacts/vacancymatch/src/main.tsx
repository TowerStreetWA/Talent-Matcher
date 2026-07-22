import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Sentry error tracking — enabled only when VITE_SENTRY_DSN is set.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Disable DOM breadcrumb capture — Sentry's default click/mutation
    // listeners try to JSON.stringify the target DOM element which contains
    // __reactFiber circular references and throws a TypeError.
    integrations: [
      Sentry.breadcrumbsIntegration({ dom: false }),
    ],
  });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Something went wrong</h2>
        <p>The error has been reported. Please refresh the page.</p>
      </div>
    }
  >
    <App />
  </Sentry.ErrorBoundary>,
);
