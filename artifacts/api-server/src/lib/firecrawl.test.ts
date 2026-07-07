import { describe, expect, it } from "vitest";
import { FirecrawlError, validateResearchUrl } from "./firecrawl";

function kindOf(raw: string): string | null {
  try {
    validateResearchUrl(raw);
    return null;
  } catch (err) {
    if (err instanceof FirecrawlError) return err.kind;
    throw err;
  }
}

describe("validateResearchUrl", () => {
  it("accepts public http and https URLs", () => {
    expect(validateResearchUrl("https://jobs.example.com/role/123").hostname).toBe(
      "jobs.example.com",
    );
    expect(validateResearchUrl("http://example.org/careers").protocol).toBe("http:");
    expect(validateResearchUrl("  https://example.com/x  ").hostname).toBe("example.com");
  });

  it("rejects non-http protocols", () => {
    expect(kindOf("ftp://example.com/file")).toBe("blocked_url");
    expect(kindOf("file:///etc/passwd")).toBe("blocked_url");
    expect(kindOf("javascript:alert(1)")).toBe("blocked_url");
  });

  it("rejects malformed URLs", () => {
    expect(kindOf("not a url")).toBe("blocked_url");
    expect(kindOf("")).toBe("blocked_url");
  });

  it("rejects embedded credentials", () => {
    expect(kindOf("https://user:pass@example.com/")).toBe("blocked_url");
  });

  it("rejects localhost and dotless hostnames", () => {
    expect(kindOf("http://localhost:8080/")).toBe("blocked_url");
    expect(kindOf("http://intranet/")).toBe("blocked_url");
    expect(kindOf("https://api.internal/x")).toBe("blocked_url");
    expect(kindOf("https://printer.local/")).toBe("blocked_url");
  });

  it("rejects private and special IPv4 ranges", () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "0.0.0.0",
      "224.0.0.1",
    ]) {
      expect(kindOf(`http://${host}/`)).toBe("blocked_url");
    }
  });

  it("allows public IPv4 addresses", () => {
    expect(kindOf("http://93.184.216.34/")).toBeNull();
    expect(kindOf("http://172.32.0.1/")).toBeNull();
  });

  it("rejects loopback and private IPv6", () => {
    expect(kindOf("http://[::1]/")).toBe("blocked_url");
    expect(kindOf("http://[fd12:3456::1]/")).toBe("blocked_url");
    expect(kindOf("http://[fe80::1]/")).toBe("blocked_url");
  });
});
