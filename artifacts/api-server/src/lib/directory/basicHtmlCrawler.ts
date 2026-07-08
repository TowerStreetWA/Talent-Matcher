import * as cheerio from "cheerio";
import { fetchPage } from "./resolveCareersBoard";

/**
 * Basic HTML careers-page crawler: a lightweight, self-hosted extractor for
 * simple/static careers pages so Firecrawl credits are reserved for
 * genuinely JS-heavy sites.
 *
 * Given an employer careers URL it fetches the page through the shared
 * SSRF-guarded fetch (same guards + redirect validation as the board
 * resolver — no new fetch paths), parses the HTML with cheerio, and tries
 * common patterns: lists of job links, card-like structures, and simple
 * "Title / Location / Department" tables. It never throws — every failure
 * mode maps to a clear outcome for routing and diagnostics.
 */

export type BasicCrawlOutcome =
  | "html_jobs_found" // extracted at least one plausible job listing
  | "html_no_jobs" // fetched + parsed OK but no job listings recognised
  | "blocked_url" // SSRF guard rejected the URL or a redirect hop
  | "fetch_failed"; // network error / timeout / non-2xx

export interface BasicCrawlJob {
  title: string;
  locationText: string | null;
  applyUrl: string;
  descriptionText: string | null;
}

export interface BasicCrawlResult {
  outcome: BasicCrawlOutcome;
  jobs: BasicCrawlJob[];
  /** Extraction pattern evidence, e.g. "html_table_detected". */
  evidence: string[];
  /** True when at least one job was extracted. */
  activePosting: boolean;
  /** True when the page looks like a JS-rendered SPA shell. */
  jsHeavy: boolean;
  finalUrl: string | null;
}

const DEFAULT_MAX_JOBS = 40;

/** href fragments that strongly suggest a job detail / application page. */
const JOB_HREF_PATTERN =
  /\/(?:jobs?|careers?|vacanc(?:y|ies)|positions?|openings?|opportunit(?:y|ies)|roles?|join-us|work-with-us)(?:\/|\?|#|$)|\/apply\b|(?:^|[?&])(?:jobid|job_id|vacancyid|vacancy_id|reqid|requisition)=/i;

/** Link texts that are navigation, not individual vacancies. */
const GENERIC_LINK_TEXT =
  /^(?:jobs?|careers?|vacanc(?:y|ies)|all\s+(?:jobs|roles|vacancies|openings)|view\s+(?:all|jobs|roles|vacancies|openings|more)(?:\s+(?:jobs|roles|vacancies|openings))?|see\s+(?:all|jobs|roles|vacancies|openings|more)(?:\s+(?:jobs|roles|vacancies|openings))?|search\s+(?:jobs|roles|vacancies)?|browse\s+(?:jobs|roles|vacancies)?|apply(?:\s+now)?|read\s+more|learn\s+more|find\s+out\s+more|more\s+info(?:rmation)?|current\s+(?:vacancies|openings|opportunities)|open\s+(?:positions|roles|vacancies)|join\s+(?:us|our\s+team)|work\s+(?:with|for)\s+us|why\s+work\s+here|benefits|life\s+at\b.*|meet\s+the\s+team|early\s+careers?|graduates?|internships?)$/i;

/** SPA / JS-framework markers used by the "JS-heavy" heuristic. */
const SPA_MARKERS =
  /__NEXT_DATA__|__NUXT__|data-reactroot|data-react-helmet|ng-version=|ng-app\b|data-v-app|id=["'](?:root|app|__next|___gatsby)["']|window\.__INITIAL_STATE__|webpackJsonp|Ember\.Application/i;

/** Location-looking text: "London", "London, UK", "New York, NY", "Remote". */
const LOCATION_TEXT_PATTERN =
  /^(?:remote|hybrid|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}(?:,\s*[A-Za-z.'\s-]{2,30}){0,2})$/;

const LOCATION_HEADER_PATTERN = /location|city|office/i;
const TITLE_HEADER_PATTERN = /title|role|position|job|vacancy/i;

/**
 * Marketing/navigation copy that careers *landing pages* use for section
 * links ("Explore AI & Careers", "Training and development"). Real vacancy
 * titles are role nouns; they don't start with imperative marketing verbs
 * or possessives, and they don't contain the word "careers".
 */
const MARKETING_TEXT_PATTERN =
  /^(?:explore|discover|learn|find(?:\s+out)?|meet|join|start|take|see|hear|watch|read|get|help|support|make|create|grow|why|how|what|who|where|our|your|we|about|working|life|hiring|belonging|wellbeing|well-being|diversity|inclusion|training|reward|rewards|salary|pay|events?|stories|news|insights?|faqs?|contact)\b/i;

const MARKETING_CONTAINS_PATTERN =
  /\bcareers?\b|\b(?:at|with)\s+(?:us|[A-Z][\w&]*)\s*$|\bour\s+(?:people|team|values|culture|offices?)\b|\bhiring\s+process\b|\bentry\s+level\b|\bschool\s+leavers?\b|\bwork\s+experience\b|\bstudents?\b|\bapprenticeships?\b|\brecruitment\b|\btalent\s+community\b|\bjob\s+search\b/i;

/**
 * Positive signal that a link text is an actual vacancy title rather than a
 * careers-site section ("Audit", "Consulting", "Technology"). Real vacancy
 * titles virtually always contain a role noun or seniority word; category
 * and marketing links virtually never do. Precision over recall: junk in
 * the jobs table poisons search/matching, a missed niche title does not.
 */
const ROLE_SIGNAL_PATTERN =
  /\b(?:manager|director|officer|executive|analyst|associate|assistant|administrator|advis[eo]r|consultant|engineer|developer|programmer|architect|designer|scientist|specialist|co-?ordinator|controller|accountant|auditor|actuar(?:y|ies)|underwriter|underwriting|broker|handler|adjuster|technician|technologist|paraplanner|planner|surveyor|economist|strategist|solicitor|lawyer|counsel|paralegal|secretary|partner|trainee|apprentice|head\s+of|lead|chief|principal|senior|junior|vp|vice\s+president|president|cfo|ceo|coo|cto|ciso|cio|buyer|trader|dealer|originator|researcher|writer|editor|nurse|surgeon|physician|teacher|tester|operator|supervisor|foreman|estimator|negotiator|receptionist|bookkeeper|payroll|actuarial\s+\w+)\b/i;

/** Trailing metadata glued onto link text: "… / Posted 1 day ago". */
const POSTED_SUFFIX_PATTERN =
  /\s*[/|·–—-]?\s*Posted\s+(?:today|yesterday|\d+\s+(?:hours?|days?|weeks?|months?)\s+ago)\s*$/i;

/** Trailing status badges rendered inside listing links: "People Advisor New". */
const BADGE_SUFFIX_PATTERN = /\s+(?:new|featured|hot|urgent|closing\s+soon)\s*$/i;

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function cleanTitle(raw: string): string {
  return cleanText(raw)
    .replace(POSTED_SUFFIX_PATTERN, "")
    .replace(BADGE_SUFFIX_PATTERN, "")
    .trim();
}

/**
 * cheerio's `.text()` concatenates text across child elements without any
 * separator, producing glued strings like "Data Analyst IIRiga, Latvia".
 * Re-parse the inner HTML with a space forced before every tag so distinct
 * elements yield space-separated text.
 */
function spacedText($el: { html(): string | null; text(): string }): string {
  const inner = $el.html();
  if (inner == null) return cleanText($el.text());
  return cleanText(cheerio.load(`<div>${inner.replace(/</g, " <")}</div>`)("div").text());
}

/**
 * Derive a vacancy title (and, when obvious, a location hint) from an
 * anchor. Prefers an explicit title element inside the anchor; otherwise,
 * when the anchor wraps several child elements, uses the first child's
 * text — the rest is usually location/badge metadata (a common pattern on
 * Greenhouse-style embeds: `<a><p>Title</p><p>City, Country</p></a>`).
 */
function titleFromAnchor(
  $a: cheerio.Cheerio<any>,
): { title: string; locationHint: string | null } {
  const titleEl = $a.find('h1, h2, h3, h4, h5, h6, [class*="title"]').first();
  if (titleEl.length > 0) {
    return { title: cleanTitle(spacedText(titleEl)), locationHint: null };
  }
  const childEls = $a.children();
  if (childEls.length >= 2) {
    const title = cleanTitle(spacedText(childEls.first()));
    let locationHint: string | null = null;
    const secondary = cleanText(spacedText(childEls.eq(childEls.length - 1)));
    if (secondary && secondary.length <= 60 && LOCATION_TEXT_PATTERN.test(secondary)) {
      locationHint = secondary;
    }
    return { title, locationHint };
  }
  return { title: cleanTitle(spacedText($a)), locationHint: null };
}

function plausibleTitle(text: string): boolean {
  if (text.length < 4 || text.length > 120) return false;
  if (GENERIC_LINK_TEXT.test(text)) return false;
  if (MARKETING_TEXT_PATTERN.test(text)) return false;
  if (MARKETING_CONTAINS_PATTERN.test(text)) return false;
  // Titles contain letters, not just "→" / "»" / numbers.
  if (!/[a-zA-Z]{3}/.test(text)) return false;
  // Positive role signal required: category/nav links ("Audit", "Deals",
  // "Technology") never carry a role noun, real vacancy titles do.
  if (!ROLE_SIGNAL_PATTERN.test(text)) return false;
  return true;
}

function resolveHref(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Detect a JS-rendered SPA shell: framework markers plus little static
 * content, or a body that is almost entirely script tags.
 */
export function detectJsHeavyHtml(html: string): boolean {
  if (!html) return true;
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const visibleText = cleanText($("body").text());
  const anchorCount = $("a[href]").length;
  if (SPA_MARKERS.test(html) && (visibleText.length < 600 || anchorCount < 8)) {
    return true;
  }
  // No markers but effectively empty static DOM — content must come from JS.
  return visibleText.length < 200 && anchorCount < 5;
}

interface Extraction {
  jobs: BasicCrawlJob[];
  evidence: string[];
}

/**
 * Extract job listings from static HTML using common structural patterns.
 * Exported for direct unit testing.
 */
export function extractJobsFromHtml(
  html: string,
  baseUrl: string,
  opts: { maxJobs?: number } = {},
): Extraction {
  const maxJobs = opts.maxJobs ?? DEFAULT_MAX_JOBS;
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header").remove();

  const jobs: BasicCrawlJob[] = [];
  const evidence = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  const push = (job: BasicCrawlJob, pattern: string): void => {
    if (jobs.length >= maxJobs) return;
    const urlKey = job.applyUrl.toLowerCase();
    const titleKey = job.title.toLowerCase();
    if (seenUrls.has(urlKey)) return;
    // Same title twice with different URLs is usually pagination noise on
    // static pages; keep the first occurrence only.
    if (seenTitles.has(titleKey)) return;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    jobs.push(job);
    evidence.add(pattern);
  };

  // Pattern 1: simple tables with Title / Location columns.
  $("table").each((_, table) => {
    const $table = $(table);
    const headers = $table
      .find("th")
      .map((_, th) => cleanText($(th).text()))
      .get();
    const titleCol = headers.findIndex((h) => TITLE_HEADER_PATTERN.test(h));
    const locationCol = headers.findIndex((h) => LOCATION_HEADER_PATTERN.test(h));
    $table.find("tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length === 0) return;
      const titleCell = titleCol >= 0 && titleCol < cells.length ? cells.eq(titleCol) : cells.eq(0);
      const link = titleCell.find("a[href]").first();
      if (link.length === 0) return;
      const derived = titleFromAnchor(link);
      const title = derived.title || cleanTitle(spacedText(titleCell));
      const href = resolveHref(link.attr("href") ?? "", baseUrl);
      if (!href || !plausibleTitle(title)) return;
      let locationText: string | null = derived.locationHint;
      if (locationCol >= 0 && locationCol < cells.length) {
        const loc = cleanText(cells.eq(locationCol).text());
        if (loc && loc.length <= 80) locationText = loc;
      }
      push({ title, locationText, applyUrl: href, descriptionText: null }, "html_table_detected");
    });
  });

  // Patterns 2+3: anchors inside list items or card-like containers.
  $("a[href]").each((_, a) => {
    const $a = $(a);
    const href = $a.attr("href") ?? "";
    const derived = titleFromAnchor($a);
    const text = derived.title;
    if (!plausibleTitle(text)) return;

    const resolved = resolveHref(href, baseUrl);
    if (!resolved) return;

    const inList = $a.closest("li").length > 0;
    const cardContainer = $a.closest(
      '[class*="job"], [class*="vacanc"], [class*="position"], [class*="opening"], [class*="career"], [class*="card"], [class*="listing"], [class*="role"]',
    );
    const inCard = cardContainer.length > 0 && cardContainer.prop("tagName") !== "BODY";
    const hrefLooksLikeJob = JOB_HREF_PATTERN.test(resolved) || JOB_HREF_PATTERN.test(href);

    // Require structural context (list/card) or a job-detail-looking href;
    // bare prose links are too noisy.
    if (!hrefLooksLikeJob && !(inCard && JOB_HREF_PATTERN.test(resolved + href))) return;
    if (!inList && !inCard && !hrefLooksLikeJob) return;

    // Avoid the page linking to itself / the careers root.
    try {
      const target = new URL(resolved);
      const base = new URL(baseUrl);
      if (
        target.hostname === base.hostname &&
        target.pathname.replace(/\/+$/, "") === base.pathname.replace(/\/+$/, "") &&
        !target.search
      ) {
        return;
      }
    } catch {
      return;
    }

    // Nearby location: an element in the same li/card with a location-ish
    // class, or a short sibling text that looks like a place name.
    let locationText: string | null = derived.locationHint;
    const container = inList ? $a.closest("li") : inCard ? cardContainer.first() : $a.parent();
    const locEl = container.find('[class*="location"], [class*="place"], [class*="city"]').first();
    if (locEl.length > 0) {
      const loc = cleanText(locEl.text());
      if (loc && loc.length <= 80) locationText = loc;
    } else {
      const siblingText = cleanText(container.clone().find("a").remove().end().text());
      if (
        siblingText &&
        siblingText.length <= 60 &&
        LOCATION_TEXT_PATTERN.test(siblingText)
      ) {
        locationText = siblingText;
      }
    }

    push(
      { title: text, locationText, applyUrl: resolved, descriptionText: null },
      inList ? "html_list_detected" : inCard ? "html_cards_detected" : "html_links_detected",
    );
  });

  return { jobs, evidence: [...evidence] };
}

/**
 * Crawl one employer careers URL. Never throws — network/SSRF failures map
 * to outcomes so the directory engine can route accordingly.
 */
export async function crawlBasicHtmlCareersPage(
  careersUrl: string,
  opts: { maxJobs?: number } = {},
): Promise<BasicCrawlResult> {
  const page = await fetchPage(careersUrl);
  if (page.kind !== "ok") {
    return {
      outcome: page.kind === "blocked" ? "blocked_url" : "fetch_failed",
      jobs: [],
      evidence: [],
      activePosting: false,
      jsHeavy: false,
      finalUrl: null,
    };
  }

  const jsHeavy = detectJsHeavyHtml(page.html);
  const { jobs, evidence } = extractJobsFromHtml(page.html, page.finalUrl, opts);
  return {
    outcome: jobs.length > 0 ? "html_jobs_found" : "html_no_jobs",
    jobs,
    evidence,
    activePosting: jobs.length > 0,
    jsHeavy,
    finalUrl: page.finalUrl,
  };
}
