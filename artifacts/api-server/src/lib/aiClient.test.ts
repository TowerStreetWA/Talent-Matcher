import { afterEach, describe, expect, it } from "vitest";
import { OpenAI } from "@workspace/integrations-openai-ai-server";
import { isRetryableAiError, resolveProviderOrder } from "./aiClient";

const ORIGINAL_AI_PROVIDER = process.env["AI_PROVIDER"];

afterEach(() => {
  if (ORIGINAL_AI_PROVIDER === undefined) {
    delete process.env["AI_PROVIDER"];
  } else {
    process.env["AI_PROVIDER"] = ORIGINAL_AI_PROVIDER;
  }
});

describe("resolveProviderOrder", () => {
  it("defaults to integration-first", () => {
    delete process.env["AI_PROVIDER"];
    expect(resolveProviderOrder()).toEqual(["integration", "direct"]);
  });

  it("prefers direct when AI_PROVIDER=direct", () => {
    process.env["AI_PROVIDER"] = "direct";
    expect(resolveProviderOrder()).toEqual(["direct", "integration"]);
    process.env["AI_PROVIDER"] = " DIRECT ";
    expect(resolveProviderOrder()).toEqual(["direct", "integration"]);
  });

  it("ignores unknown values", () => {
    process.env["AI_PROVIDER"] = "something-else";
    expect(resolveProviderOrder()).toEqual(["integration", "direct"]);
  });
});

function apiError(status: number): InstanceType<typeof OpenAI.APIError> {
  return new OpenAI.APIError(status, { message: "x" }, "x", undefined);
}

describe("isRetryableAiError", () => {
  it("retries rate limits, timeouts and server errors", () => {
    expect(isRetryableAiError(apiError(429))).toBe(true);
    expect(isRetryableAiError(apiError(408))).toBe(true);
    expect(isRetryableAiError(apiError(500))).toBe(true);
    expect(isRetryableAiError(apiError(503))).toBe(true);
  });

  it("does not retry client errors", () => {
    expect(isRetryableAiError(apiError(400))).toBe(false);
    expect(isRetryableAiError(apiError(401))).toBe(false);
    expect(isRetryableAiError(apiError(404))).toBe(false);
  });

  it("retries network-level failures", () => {
    expect(isRetryableAiError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableAiError(new Error("connect ECONNREFUSED 1.2.3.4:443"))).toBe(true);
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(isRetryableAiError(abort)).toBe(true);
  });

  it("does not retry arbitrary errors", () => {
    expect(isRetryableAiError(new Error("invalid JSON in response"))).toBe(false);
    expect(isRetryableAiError("string error")).toBe(false);
  });
});
