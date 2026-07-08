import { z } from "zod/v4";
import type { AtsEmployerConfig } from "../../../config/atsEmployers";
import { resolveAtsMaxJobs } from "../../../config/atsEmployers";
import { IngestionError, type NormalizedVacancy } from "../types";
import {
  clampText,
  decodeEntities,
  fetchAtsJson,
  fetchAtsResponse,
  matchesLocationFilter,
  parseDateLoose,
  parseWorkdayPostedOn,
  stripHtml,
} from "./support";

/**
 * Per-platform ATS job-board fetchers. Each fetcher hits the platform's
 * public JSON/RSS job-board endpoint for one configured employer and maps
 * postings into NormalizedVacancy. All are sourceType "direct_employer" —
 * these are the employer's own hosted career boards.
 */

export interface AtsFetcherContext {
  vacancies: NormalizedVacancy[];
  warnings: string[];
}

function pushVacancy(
  ctx: AtsFetcherContext,
  entry: AtsEmployerConfig,
  sourceProvider: string,
  v: Omit<NormalizedVacancy, "sourceType" | "sourceProvider" | "sectorTag" | "skills">,
): void {
  ctx.vacancies.push({
    ...v,
    skills: [],
    sourceType: "direct_employer",
    sourceProvider,
    sectorTag: entry.sectorTag ?? null,
  });
}

// ---------------------------------------------------------------- Lever ----

const leverPostingSchema = z
  .object({
    text: z.string().nullish(),
    hostedUrl: z.string().nullish(),
    applyUrl: z.string().nullish(),
    createdAt: z.number().nullish(),
    descriptionPlain: z.string().nullish(),
    workplaceType: z.string().nullish(),
    categories: z
      .object({
        location: z.string().nullish(),
        commitment: z.string().nullish(),
        allLocations: z.array(z.string()).nullish(),
      })
      .loose()
      .nullish(),
  })
  .loose();

export async function fetchLever(entry: AtsEmployerConfig, ctx: AtsFetcherContext): Promise<void> {
  const cap = resolveAtsMaxJobs(entry);
  const payload = await fetchAtsJson(
    "Lever",
    `https://api.lever.co/v0/postings/${encodeURIComponent(entry.token)}?mode=json&limit=${Math.min(cap * 3, 250)}`,
  );
  const parsed = z.array(leverPostingSchema).safeParse(payload);
  if (!parsed.success) {
    throw new IngestionError("upstream", `Lever returned an unexpected shape for ${entry.company}`);
  }
  let taken = 0;
  for (const posting of parsed.data) {
    if (taken >= cap) break;
    if (!posting.text) {
      ctx.warnings.push(`Lever/${entry.company}: skipped a posting without a title`);
      continue;
    }
    const location =
      posting.categories?.location ?? posting.categories?.allLocations?.[0] ?? null;
    if (!matchesLocationFilter(location, entry.locationIncludes)) continue;
    const url = posting.hostedUrl ?? null;
    pushVacancy(ctx, entry, "ats_lever", {
      title: posting.text,
      companyName: entry.company,
      locationText: location,
      remoteType:
        posting.workplaceType === "remote" || posting.workplaceType === "hybrid"
          ? posting.workplaceType
          : null,
      employmentType: posting.categories?.commitment ?? null,
      salaryText: null,
      descriptionText: clampText(posting.descriptionPlain ?? null),
      postedAt: parseDateLoose(posting.createdAt ?? null),
      applyUrl: posting.applyUrl ?? url,
      sourceUrl: url,
    });
    taken += 1;
  }
}

// ---------------------------------------------------------------- Ashby ----

const ashbyJobSchema = z
  .object({
    title: z.string().nullish(),
    location: z.string().nullish(),
    employmentType: z.string().nullish(),
    publishedAt: z.string().nullish(),
    isListed: z.boolean().nullish(),
    isRemote: z.boolean().nullish(),
    workplaceType: z.string().nullish(),
    jobUrl: z.string().nullish(),
    applyUrl: z.string().nullish(),
    descriptionPlain: z.string().nullish(),
    compensation: z.object({ compensationTierSummary: z.string().nullish() }).loose().nullish(),
  })
  .loose();

const ashbyResponseSchema = z.object({ jobs: z.array(ashbyJobSchema).nullish() }).loose();

export async function fetchAshby(entry: AtsEmployerConfig, ctx: AtsFetcherContext): Promise<void> {
  const cap = resolveAtsMaxJobs(entry);
  const payload = await fetchAtsJson(
    "Ashby",
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(entry.token)}?includeCompensation=true`,
  );
  const parsed = ashbyResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new IngestionError("upstream", `Ashby returned an unexpected shape for ${entry.company}`);
  }
  let taken = 0;
  for (const job of parsed.data.jobs ?? []) {
    if (taken >= cap) break;
    if (job.isListed === false) continue;
    if (!job.title) {
      ctx.warnings.push(`Ashby/${entry.company}: skipped a posting without a title`);
      continue;
    }
    if (!matchesLocationFilter(job.location ?? null, entry.locationIncludes)) continue;
    pushVacancy(ctx, entry, "ats_ashby", {
      title: job.title,
      companyName: entry.company,
      locationText: job.location ?? null,
      remoteType: job.isRemote ? "remote" : (job.workplaceType?.toLowerCase() === "hybrid" ? "hybrid" : null),
      employmentType: job.employmentType ?? null,
      salaryText: job.compensation?.compensationTierSummary ?? null,
      descriptionText: clampText(job.descriptionPlain ?? null),
      postedAt: parseDateLoose(job.publishedAt ?? null),
      applyUrl: job.applyUrl ?? job.jobUrl ?? null,
      sourceUrl: job.jobUrl ?? null,
    });
    taken += 1;
  }
}

// ------------------------------------------------------------- Workable ----

const workableJobSchema = z
  .object({
    title: z.string().nullish(),
    url: z.string().nullish(),
    application_url: z.string().nullish(),
    employment_type: z.string().nullish(),
    telecommuting: z.boolean().nullish(),
    published_on: z.string().nullish(),
    created_at: z.string().nullish(),
    country: z.string().nullish(),
    city: z.string().nullish(),
  })
  .loose();

const workableResponseSchema = z.object({ jobs: z.array(workableJobSchema).nullish() }).loose();

export async function fetchWorkable(
  entry: AtsEmployerConfig,
  ctx: AtsFetcherContext,
): Promise<void> {
  const cap = resolveAtsMaxJobs(entry);
  const payload = await fetchAtsJson(
    "Workable",
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(entry.token)}`,
  );
  const parsed = workableResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new IngestionError(
      "upstream",
      `Workable returned an unexpected shape for ${entry.company}`,
    );
  }
  let taken = 0;
  for (const job of parsed.data.jobs ?? []) {
    if (taken >= cap) break;
    if (!job.title) {
      ctx.warnings.push(`Workable/${entry.company}: skipped a posting without a title`);
      continue;
    }
    const location = [job.city, job.country].filter((p) => p && p.length > 0).join(", ") || null;
    if (!matchesLocationFilter(location, entry.locationIncludes)) continue;
    pushVacancy(ctx, entry, "ats_workable", {
      title: job.title,
      companyName: entry.company,
      locationText: location,
      remoteType: job.telecommuting ? "remote" : null,
      employmentType: job.employment_type ?? null,
      salaryText: null,
      descriptionText: null,
      postedAt: parseDateLoose(job.published_on ?? job.created_at ?? null),
      applyUrl: job.application_url ?? job.url ?? null,
      sourceUrl: job.url ?? null,
    });
    taken += 1;
  }
}

// ------------------------------------------------------ SmartRecruiters ----

const smartRecruitersPostingSchema = z
  .object({
    id: z.string().nullish(),
    name: z.string().nullish(),
    releasedDate: z.string().nullish(),
    company: z.object({ name: z.string().nullish() }).loose().nullish(),
    location: z
      .object({
        city: z.string().nullish(),
        country: z.string().nullish(),
        fullLocation: z.string().nullish(),
        remote: z.boolean().nullish(),
      })
      .loose()
      .nullish(),
    typeOfEmployment: z.object({ label: z.string().nullish() }).loose().nullish(),
  })
  .loose();

const smartRecruitersResponseSchema = z
  .object({
    totalFound: z.number().nullish(),
    content: z.array(smartRecruitersPostingSchema).nullish(),
  })
  .loose();

export async function fetchSmartRecruiters(
  entry: AtsEmployerConfig,
  ctx: AtsFetcherContext,
): Promise<void> {
  const cap = resolveAtsMaxJobs(entry);
  const pageSize = 100;
  let offset = 0;
  let taken = 0;
  // Location filtering happens client-side, so page until the cap or the end.
  for (let page = 0; page < 5 && taken < cap; page++) {
    const payload = await fetchAtsJson(
      "SmartRecruiters",
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(entry.token)}/postings?limit=${pageSize}&offset=${offset}`,
    );
    const parsed = smartRecruitersResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new IngestionError(
        "upstream",
        `SmartRecruiters returned an unexpected shape for ${entry.company}`,
      );
    }
    const postings = parsed.data.content ?? [];
    if (postings.length === 0) break;
    for (const posting of postings) {
      if (taken >= cap) break;
      if (!posting.name) {
        ctx.warnings.push(`SmartRecruiters/${entry.company}: skipped a posting without a title`);
        continue;
      }
      const location =
        posting.location?.fullLocation ??
        [posting.location?.city, posting.location?.country]
          .filter((p) => p && p.length > 0)
          .join(", ") ??
        null;
      if (!matchesLocationFilter(location, entry.locationIncludes)) continue;
      const url = posting.id
        ? `https://jobs.smartrecruiters.com/${encodeURIComponent(entry.token)}/${posting.id}`
        : null;
      pushVacancy(ctx, entry, "ats_smartrecruiters", {
        title: posting.name,
        companyName: posting.company?.name ?? entry.company,
        locationText: location || null,
        remoteType: posting.location?.remote ? "remote" : null,
        employmentType: posting.typeOfEmployment?.label ?? null,
        salaryText: null,
        descriptionText: null,
        postedAt: parseDateLoose(posting.releasedDate ?? null),
        applyUrl: url,
        sourceUrl: url,
      });
      taken += 1;
    }
    offset += pageSize;
    const total = parsed.data.totalFound ?? 0;
    if (offset >= total) break;
  }
}

// ------------------------------------------------------------ Recruitee ----

const recruiteeOfferSchema = z
  .object({
    title: z.string().nullish(),
    location: z.string().nullish(),
    city: z.string().nullish(),
    country: z.string().nullish(),
    careers_url: z.string().nullish(),
    careers_apply_url: z.string().nullish(),
    created_at: z.string().nullish(),
    published_at: z.string().nullish(),
    employment_type_code: z.string().nullish(),
    remote: z.boolean().nullish(),
    hybrid: z.boolean().nullish(),
    description: z.string().nullish(),
    status: z.string().nullish(),
    company_name: z.string().nullish(),
  })
  .loose();

const recruiteeResponseSchema = z
  .object({ offers: z.array(recruiteeOfferSchema).nullish() })
  .loose();

export async function fetchRecruitee(
  entry: AtsEmployerConfig,
  ctx: AtsFetcherContext,
): Promise<void> {
  const cap = resolveAtsMaxJobs(entry);
  const payload = await fetchAtsJson(
    "Recruitee",
    `https://${encodeURIComponent(entry.token)}.recruitee.com/api/offers/`,
  );
  const parsed = recruiteeResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new IngestionError(
      "upstream",
      `Recruitee returned an unexpected shape for ${entry.company}`,
    );
  }
  let taken = 0;
  for (const offer of parsed.data.offers ?? []) {
    if (taken >= cap) break;
    if (offer.status && offer.status !== "published") continue;
    if (!offer.title) {
      ctx.warnings.push(`Recruitee/${entry.company}: skipped an offer without a title`);
      continue;
    }
    const location =
      offer.location ??
      ([offer.city, offer.country].filter((p) => p && p.length > 0).join(", ") || null);
    if (!matchesLocationFilter(location, entry.locationIncludes)) continue;
    pushVacancy(ctx, entry, "ats_recruitee", {
      title: offer.title,
      companyName: offer.company_name ?? entry.company,
      locationText: location,
      remoteType: offer.remote ? "remote" : offer.hybrid ? "hybrid" : null,
      employmentType: offer.employment_type_code ?? null,
      salaryText: null,
      descriptionText: clampText(stripHtml(offer.description ?? null)),
      postedAt: parseDateLoose(offer.published_at ?? offer.created_at ?? null),
      applyUrl: offer.careers_apply_url ?? offer.careers_url ?? null,
      sourceUrl: offer.careers_url ?? null,
    });
    taken += 1;
  }
}

// ----------------------------------------------------------- Teamtailor ----

function rssTag(item: string, tag: string): string | null {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m?.[1]) return null;
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  return raw.length > 0 ? decodeEntities(raw) : null;
}

export async function fetchTeamtailor(
  entry: AtsEmployerConfig,
  ctx: AtsFetcherContext,
): Promise<void> {
  const cap = resolveAtsMaxJobs(entry);
  const response = await fetchAtsResponse(
    "Teamtailor",
    `https://${encodeURIComponent(entry.token)}.teamtailor.com/jobs.rss`,
  );
  if (!response.ok) {
    throw new IngestionError("upstream", `Teamtailor error (HTTP ${response.status})`);
  }
  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  let taken = 0;
  for (const item of items) {
    if (taken >= cap) break;
    const title = rssTag(item, "title");
    if (!title) {
      ctx.warnings.push(`Teamtailor/${entry.company}: skipped an item without a title`);
      continue;
    }
    const locationNames = [...item.matchAll(/<tt:name>([\s\S]*?)<\/tt:name>/g)]
      .map((m) => decodeEntities(m[1]!.trim()))
      .filter((s) => s.length > 0);
    const location = locationNames.join(" / ") || null;
    if (!matchesLocationFilter(location, entry.locationIncludes)) continue;
    const link = rssTag(item, "link");
    const remoteStatus = rssTag(item, "remoteStatus");
    pushVacancy(ctx, entry, "ats_teamtailor", {
      title,
      companyName: entry.company,
      locationText: location,
      remoteType:
        remoteStatus === "fully" ? "remote" : remoteStatus === "hybrid" ? "hybrid" : null,
      employmentType: null,
      salaryText: null,
      descriptionText: clampText(stripHtml(rssTag(item, "description"))),
      postedAt: parseDateLoose(rssTag(item, "pubDate")),
      applyUrl: link,
      sourceUrl: link,
    });
    taken += 1;
  }
}

// -------------------------------------------------------------- Workday ----

const workdayPostingSchema = z
  .object({
    title: z.string().nullish(),
    externalPath: z.string().nullish(),
    locationsText: z.string().nullish(),
    postedOn: z.string().nullish(),
  })
  .loose();

const workdayResponseSchema = z
  .object({
    total: z.number().nullish(),
    jobPostings: z.array(workdayPostingSchema).nullish(),
  })
  .loose();

export async function fetchWorkday(
  entry: AtsEmployerConfig,
  ctx: AtsFetcherContext,
): Promise<void> {
  const instance = entry.workdayInstance;
  const site = entry.workdaySite;
  if (!instance || !site) {
    throw new IngestionError(
      "config",
      `Workday entry for ${entry.company} needs workdayInstance and workdaySite`,
    );
  }
  const cap = resolveAtsMaxJobs(entry);
  const base = `https://${entry.token}.${instance}.myworkdayjobs.com`;
  const pageSize = 20;
  let offset = 0;
  let taken = 0;
  for (let page = 0; page < 10 && taken < cap; page++) {
    const payload = await fetchAtsJson(
      "Workday",
      `${base}/wday/cxs/${entry.token}/${site}/jobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: pageSize, offset, searchText: "" }),
      },
    );
    const parsed = workdayResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new IngestionError(
        "upstream",
        `Workday returned an unexpected shape for ${entry.company}`,
      );
    }
    const postings = parsed.data.jobPostings ?? [];
    if (postings.length === 0) break;
    for (const posting of postings) {
      if (taken >= cap) break;
      if (!posting.title) {
        ctx.warnings.push(`Workday/${entry.company}: skipped a posting without a title`);
        continue;
      }
      if (!matchesLocationFilter(posting.locationsText ?? null, entry.locationIncludes)) continue;
      const url = posting.externalPath ? `${base}/en-US/${site}${posting.externalPath}` : null;
      pushVacancy(ctx, entry, "ats_workday", {
        title: posting.title,
        companyName: entry.company,
        locationText: posting.locationsText ?? null,
        remoteType: null,
        employmentType: null,
        salaryText: null,
        descriptionText: null,
        postedAt: parseWorkdayPostedOn(posting.postedOn ?? null),
        applyUrl: url,
        sourceUrl: url,
      });
      taken += 1;
    }
    offset += pageSize;
    const total = parsed.data.total ?? 0;
    if (offset >= total) break;
  }
}
