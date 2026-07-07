import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

/**
 * Create an OpenAI client for a user-supplied API key (e.g. a direct
 * OPENAI_API_KEY fallback). Exported from this lib so consumers share a
 * single `openai` package identity — importing the package separately can
 * peer-split it, breaking `instanceof OpenAI.APIError` checks at runtime.
 */
export function createDirectOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

export { OpenAI };
