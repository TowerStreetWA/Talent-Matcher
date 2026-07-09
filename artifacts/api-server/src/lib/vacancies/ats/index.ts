import {
  ATS_EMPLOYERS,
  type AtsEmployerConfig,
  type AtsPlatform,
} from "../../../config/atsEmployers";
import {
  IngestionError,
  type AtsFetchInput,
  type ProviderFetchResult,
  type VacancyProvider,
} from "../types";
import {
  fetchAshby,
  fetchGreenhouse,
  fetchIcims,
  fetchLever,
  fetchRecruitee,
  fetchSmartRecruiters,
  fetchSuccessFactors,
  fetchTeamtailor,
  fetchWorkable,
  fetchWorkday,
  type AtsFetcherContext,
} from "./fetchers";

/**
 * ATS job-board providers (source-expansion phase). One provider per ATS
 * platform so each shows up as a distinct source with its own funnel metrics.
 * Employers are configured in config/atsEmployers.ts — expanding coverage
 * means adding config entries, not code.
 */

type PlatformFetcher = (entry: AtsEmployerConfig, ctx: AtsFetcherContext) => Promise<void>;

const FETCHERS: Record<AtsPlatform, PlatformFetcher> = {
  lever: fetchLever,
  ashby: fetchAshby,
  workable: fetchWorkable,
  smartrecruiters: fetchSmartRecruiters,
  recruitee: fetchRecruitee,
  teamtailor: fetchTeamtailor,
  workday: fetchWorkday,
  greenhouse: fetchGreenhouse,
  icims: fetchIcims,
  successfactors: fetchSuccessFactors,
};

export const ATS_PLATFORMS = Object.keys(FETCHERS) as AtsPlatform[];

export function atsProviderKey(platform: AtsPlatform): string {
  return `ats_${platform}`;
}

export function makeAtsProvider(platform: AtsPlatform): VacancyProvider {
  const fetcher = FETCHERS[platform];
  return {
    sourceType: "direct_employer",
    sourceProvider: atsProviderKey(platform),

    async fetchVacancies(input: AtsFetchInput): Promise<ProviderFetchResult> {
      const configured = ATS_EMPLOYERS.filter((e) => e.platform === platform);
      const requested = input.companies?.map((c) => c.toLowerCase());
      const selected = requested?.length
        ? configured.filter(
            (e) =>
              requested.includes(e.company.toLowerCase()) ||
              requested.includes(e.token.toLowerCase()),
          )
        : configured;
      if (selected.length === 0) {
        throw new IngestionError(
          "config",
          `No configured ${platform} employers${requested?.length ? " match the requested companies" : ""}`,
        );
      }

      const ctx: AtsFetcherContext = { vacancies: [], warnings: [] };
      for (const entry of selected) {
        try {
          await fetcher(entry, ctx);
        } catch (err) {
          // One employer's board failing must not sink the whole platform run.
          if (err instanceof IngestionError) {
            ctx.warnings.push(`${platform}/${entry.company}: ${err.message}`);
            continue;
          }
          throw err;
        }
      }
      return { vacancies: ctx.vacancies, warnings: ctx.warnings };
    },
  };
}
