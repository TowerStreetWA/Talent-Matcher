import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedResolution,
  clearResolutionCache,
  detectBoardUrlsInHtml,
  detectUnsupportedAts,
  resolveCareersBoard,
} from "./resolveCareersBoard";

function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  location?: string;
  url: string;
  html: string;
}): unknown {
  const encoded = new TextEncoder().encode(opts.html);
  let read = false;
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    url: opts.url,
    headers: { get: (name: string) => (name === "location" ? (opts.location ?? null) : null) },
    body: {
      getReader() {
        return {
          read: async () => {
            if (read) return { done: true, value: undefined };
            read = true;
            return { done: false, value: encoded };
          },
          cancel: async () => undefined,
        };
      },
    },
  };
}

const opts = { company: "Acme", sectorTag: "banking" };

describe("detectBoardUrlsInHtml", () => {
  it("finds supported ATS board URLs and dedupes them", () => {
    const html = `
      <a href="https://jobs.lever.co/acme">Jobs</a>
      <script src="https://jobs.lever.co/acme"></script>
      <iframe src="https://acme.wd3.myworkdayjobs.com/en-US/External"></iframe>
      <a href="https://jobs.ashbyhq.com/acme-co">Ashby</a>
    `;
    const urls = detectBoardUrlsInHtml(html);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://jobs.lever.co/acme");
    expect(urls).toContain("https://jobs.ashbyhq.com/acme-co");
  });

  it("returns empty for HTML without board links", () => {
    expect(detectBoardUrlsInHtml("<html><body>Join us!</body></html>")).toEqual([]);
  });
});

describe("detectUnsupportedAts", () => {
  it("detects greenhouse and icims", () => {
    expect(detectUnsupportedAts('href="https://boards.greenhouse.io/monzo"')).toBe(
      "greenhouse",
    );
    expect(detectUnsupportedAts("https://careers-acme.icims.com/jobs")).toBe("icims");
    expect(detectUnsupportedAts("plain html")).toBeNull();
  });
});

describe("resolveCareersBoard", () => {
  beforeEach(() => clearResolutionCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    clearResolutionCache();
  });

  it("recognises a careers URL that is already a board without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await resolveCareersBoard("https://jobs.lever.co/zopa", opts);
    expect(r.outcome).toBe("careers_url_is_board");
    expect(r.entry).toMatchObject({ platform: "lever", token: "zopa" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves via redirect to a board URL without fetching the board page", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        ok: false,
        status: 302,
        location: "https://acme.wd3.myworkdayjobs.com/External",
        url: "https://acme.com/careers",
        html: "",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveCareersBoard("https://acme.com/careers", opts);
    expect(r.outcome).toBe("redirected_to_board");
    expect(r.entry).toMatchObject({ platform: "workday", token: "acme" });
    expect(r.finalUrl).toBe("https://acme.wd3.myworkdayjobs.com/External");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves via a board link in the HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse({
          url: "https://acme.com/careers",
          html: '<a href="https://jobs.ashbyhq.com/acme">See open roles</a>',
        }),
      ),
    );
    const r = await resolveCareersBoard("https://acme.com/careers", opts);
    expect(r.outcome).toBe("board_link_in_html");
    expect(r.entry).toMatchObject({ platform: "ashby", token: "acme" });
    expect(r.boardUrl).toBe("https://jobs.ashbyhq.com/acme");
  });

  it("reports unsupported ATS platforms", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse({
          url: "https://monzo.com/careers",
          html: '<a href="https://job-boards.greenhouse.io/monzo">Roles</a>',
        }),
      ),
    );
    const r = await resolveCareersBoard("https://monzo.com/careers", opts);
    expect(r.outcome).toBe("unsupported_ats");
    expect(r.unsupportedAts).toBe("greenhouse");
    expect(r.entry).toBeNull();
  });

  it("reports no_board_detected and fetch_failed distinctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse({ url: "https://a.com/careers", html: "<p>Hi</p>" })),
    );
    const none = await resolveCareersBoard("https://a.com/careers", opts);
    expect(none.outcome).toBe("no_board_detected");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const failed = await resolveCareersBoard("https://b.com/careers", opts);
    expect(failed.outcome).toBe("fetch_failed");
    expect(failed.entry).toBeNull();
  });

  it("blocks private, localhost and non-http URLs without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const url of [
      "http://localhost/careers",
      "http://127.0.0.1:8080/careers",
      "http://10.0.0.5/careers",
      "http://169.254.169.254/latest/meta-data/",
      "http://internal-host/careers",
      "file:///etc/passwd",
      "http://user:pass@example.com/careers",
    ]) {
      clearResolutionCache();
      const r = await resolveCareersBoard(url, opts);
      expect(r.outcome, url).toBe("blocked_url");
      expect(r.entry).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks redirects that hop to private hosts", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        ok: false,
        status: 302,
        location: "http://169.254.169.254/latest/meta-data/",
        url: "https://acme.com/careers",
        html: "",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveCareersBoard("https://acme.com/careers", opts);
    expect(r.outcome).toBe("blocked_url");
    expect(fetchMock).toHaveBeenCalledTimes(1); // never fetches the private target
  });

  it("gives up after too many redirect hops", async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n += 1;
      return fakeResponse({
        ok: false,
        status: 302,
        location: `https://acme.com/hop${n}`,
        url: "https://acme.com/careers",
        html: "",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveCareersBoard("https://acme.com/careers", opts);
    expect(r.outcome).toBe("fetch_failed");
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("caches results per URL and exposes them via cachedResolution", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        url: "https://acme.com/careers",
        html: '<a href="https://jobs.lever.co/acme">Jobs</a>',
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await resolveCareersBoard("https://acme.com/careers", opts);
    const again = await resolveCareersBoard("https://acme.com/careers/", {
      company: "Other Name",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Cache stores URL-level facts; entry is re-bound per caller.
    expect(again.entry).toMatchObject({ platform: "lever", token: "acme", company: "Other Name" });
    expect(cachedResolution("https://acme.com/careers")?.outcome).toBe("board_link_in_html");
    expect(cachedResolution("https://unseen.com/careers")).toBeNull();
  });
});
