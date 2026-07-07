import {
  openai as integrationClient,
  createDirectOpenAIClient,
  OpenAI,
} from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

export type AiProvider = "integration" | "direct";

/**
 * Provider routing:
 * - Default: the Replit AI integration proxy is primary; the direct
 *   OPENAI_API_KEY client (when configured) is an automatic fallback for
 *   retryable failures (rate limits, timeouts, 5xx, network errors).
 * - Set AI_PROVIDER=direct to prefer the direct key, with the integration
 *   proxy as the fallback. Any other value (or unset) keeps the default.
 */
export function resolveProviderOrder(): AiProvider[] {
  const preference = process.env["AI_PROVIDER"]?.trim().toLowerCase();
  if (preference === "direct") return ["direct", "integration"];
  return ["integration", "direct"];
}

let directClient: OpenAI | null | undefined;

function getDirectClient(): OpenAI | null {
  if (directClient !== undefined) return directClient;
  const key = process.env["OPENAI_API_KEY"]?.trim();
  directClient = key ? createDirectOpenAIClient(key) : null;
  return directClient;
}

function clientFor(provider: AiProvider): OpenAI | null {
  return provider === "integration" ? integrationClient : getDirectClient();
}

/**
 * Failures worth retrying on the other provider: rate limits, timeouts,
 * server errors, and network-level failures. Non-retryable errors (e.g.
 * invalid request, content policy) would fail identically on both
 * providers, so they are rethrown immediately.
 */
export function isRetryableAiError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    return status === undefined || status === 408 || status === 429 || status >= 500;
  }
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "APIConnectionError") return true;
    return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|network/i.test(
      err.message,
    );
  }
  return false;
}

type ChatParams = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "stream">;

export interface AiChatResult {
  completion: OpenAI.Chat.Completions.ChatCompletion;
  provider: AiProvider;
}

/**
 * Run a chat completion against the preferred provider, falling back to the
 * other provider on retryable failures. The direct path can override the
 * model via OPENAI_DIRECT_MODEL (defaults to the requested model).
 */
export async function chatCompletion(params: ChatParams): Promise<AiChatResult> {
  const order = resolveProviderOrder().filter((p) => clientFor(p) !== null);
  if (order.length === 0) {
    throw new Error("No AI provider is configured");
  }

  let lastError: unknown;
  for (let i = 0; i < order.length; i++) {
    const provider = order[i]!;
    const client = clientFor(provider)!;
    const model =
      provider === "direct"
        ? process.env["OPENAI_DIRECT_MODEL"]?.trim() || params.model
        : params.model;
    try {
      const completion = await client.chat.completions.create({ ...params, model });
      if (i > 0) {
        logger.warn(
          { event: "ai_provider_fallback", provider, model },
          "AI request succeeded on fallback provider",
        );
      }
      return { completion, provider };
    } catch (err) {
      lastError = err;
      const hasNext = i < order.length - 1;
      if (!hasNext || !isRetryableAiError(err)) {
        throw err;
      }
      logger.warn(
        {
          event: "ai_provider_failover",
          failedProvider: provider,
          nextProvider: order[i + 1],
          error: err instanceof Error ? err.message : String(err),
        },
        "AI provider failed with retryable error, trying fallback",
      );
    }
  }
  throw lastError;
}
