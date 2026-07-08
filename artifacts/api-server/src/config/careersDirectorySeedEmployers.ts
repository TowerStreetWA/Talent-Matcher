// AUTO-GENERATED from src/config/data/careers-directory-seed.json
// by scripts/src/generateCareersDirectorySeed.ts — DO NOT hand-edit.
// To update: edit the seed JSON, then run
//   pnpm --filter @workspace/scripts run generate:careers-directory
//
// Data-only config: no business logic. Routing (ATS vs generic careers-page
// scraping, careers→board resolution) lives in lib/directory/engine.ts.

export type SeedIndustryKey =
  | "banking"
  | "pensions"
  | "asset_management"
  | "accountancy_finance"
  | "it_tech";

export interface SeedDirectoryEmployer {
  name: string;
  careersUrl: string;
  segment: string;
  platformHint:
    | "lever"
    | "ashby"
    | "workable"
    | "smartrecruiters"
    | "recruitee"
    | "teamtailor"
    | "workday"
    | "careers_page";
  sectorTag: SeedIndustryKey;
  notes?: string;
}

export interface SeedIndustryDirectory {
  label: string;
  segments: string[];
  employers: SeedDirectoryEmployer[];
}

export const CAREERS_DIRECTORY_SEED: Record<SeedIndustryKey, SeedIndustryDirectory> = {
  banking: {
    label: "Banking & Lending",
    segments: ["retail_bank","challenger_bank","commercial_lender"],
    employers: [
    {
      name: "Barclays",
      careersUrl: "https://search.jobs.barclays",
      segment: "retail_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "HSBC",
      careersUrl: "https://mycareer.hsbc.com/en_GB/external",
      segment: "retail_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Lloyds Banking Group",
      careersUrl: "https://www.lloydsbankinggrouptalent.com",
      segment: "retail_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "NatWest Group",
      careersUrl: "https://jobs.natwestgroup.com",
      segment: "retail_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Santander UK",
      careersUrl: "https://www.santanderjobs.co.uk",
      segment: "retail_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Standard Chartered",
      careersUrl: "https://jobs.standardchartered.com",
      segment: "retail_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Virgin Money",
      careersUrl: "https://careers.virginmoney.com",
      segment: "retail_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Metro Bank",
      careersUrl: "https://careers.metrobankonline.co.uk",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Monzo",
      careersUrl: "https://monzo.com/careers",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Starling Bank",
      careersUrl: "https://www.starlingbank.com/careers/",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Revolut",
      careersUrl: "https://www.revolut.com/careers/",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Zopa",
      careersUrl: "https://jobs.lever.co/zopa",
      segment: "challenger_bank",
      platformHint: "lever",
      sectorTag: "banking",
    },
    {
      name: "Atom Bank",
      careersUrl: "https://www.atombank.co.uk/careers/",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Allica Bank",
      careersUrl: "https://www.allica.bank/careers",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "ClearBank",
      careersUrl: "https://clear.bank/careers",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "OakNorth",
      careersUrl: "https://www.oaknorth.co.uk/careers/",
      segment: "commercial_lender",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Shawbrook Bank",
      careersUrl: "https://www.shawbrook.co.uk/careers/",
      segment: "commercial_lender",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    {
      name: "Tandem Bank",
      careersUrl: "https://www.tandem.co.uk/careers",
      segment: "challenger_bank",
      platformHint: "careers_page",
      sectorTag: "banking",
    },
    ],
  },
  pensions: {
    label: "Pensions & Retirement",
    segments: ["provider","administrator","consultancy"],
    employers: [
    {
      name: "Aviva",
      careersUrl: "https://careers.aviva.com",
      segment: "provider",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Legal & General",
      careersUrl: "https://careers.legalandgeneral.com",
      segment: "provider",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Royal London",
      careersUrl: "https://jobs.royallondon.com",
      segment: "provider",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Phoenix Group",
      careersUrl: "https://www.thephoenixgroup.com/careers",
      segment: "provider",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Aegon UK",
      careersUrl: "https://www.aegon.co.uk/careers",
      segment: "provider",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Smart Pension",
      careersUrl: "https://www.smartpension.co.uk/careers",
      segment: "provider",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "The People's Partnership",
      careersUrl: "https://peoplespartnership.co.uk/careers/",
      segment: "provider",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "XPS Pensions Group",
      careersUrl: "https://careers.xpsgroup.com",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Barnett Waddingham",
      careersUrl: "https://www.barnett-waddingham.co.uk/careers/",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Hymans Robertson",
      careersUrl: "https://careers.hymans.co.uk",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "LCP",
      careersUrl: "https://www.lcp.com/en/careers",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "WTW",
      careersUrl: "https://careers.wtwco.com",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Marsh McLennan (Mercer)",
      careersUrl: "https://careers.marshmclennan.com",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Isio",
      careersUrl: "https://www.isio.com/careers/",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Broadstone",
      careersUrl: "https://broadstone.co.uk/careers/",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    {
      name: "Capita Pension Solutions",
      careersUrl: "https://www.capita.com/careers",
      segment: "administrator",
      platformHint: "careers_page",
      sectorTag: "pensions",
    },
    ],
  },
  asset_management: {
    label: "Asset & Wealth Management",
    segments: ["asset_manager","hedge_fund","private_markets","wealth_manager"],
    employers: [
    {
      name: "Schroders",
      careersUrl: "https://www.schroders.com/en/global/individual/about-us/careers/",
      segment: "asset_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "abrdn",
      careersUrl: "https://careers.abrdn.com",
      segment: "asset_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "M&G",
      careersUrl: "https://careers.mandg.com",
      segment: "asset_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Baillie Gifford",
      careersUrl: "https://careers.bailliegifford.com",
      segment: "asset_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Janus Henderson",
      careersUrl: "https://www.janushenderson.com/en-gb/careers/",
      segment: "asset_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Jupiter Asset Management",
      careersUrl: "https://www.jupiteram.com/careers/",
      segment: "asset_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Fidelity International",
      careersUrl: "https://careers.fidelityinternational.com",
      segment: "asset_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Man Group",
      careersUrl: "https://www.man.com/careers",
      segment: "hedge_fund",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Marshall Wace",
      careersUrl: "https://www.mwam.com/careers/",
      segment: "hedge_fund",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Brevan Howard",
      careersUrl: "https://www.brevanhoward.com/careers/",
      segment: "hedge_fund",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Bridgepoint",
      careersUrl: "https://www.bridgepoint.eu/careers",
      segment: "private_markets",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "ICG",
      careersUrl: "https://www.icgam.com/careers/",
      segment: "private_markets",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "3i Group",
      careersUrl: "https://www.3i.com/careers/",
      segment: "private_markets",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Rathbones",
      careersUrl: "https://www.rathbones.com/careers",
      segment: "wealth_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "Evelyn Partners",
      careersUrl: "https://www.evelyn.com/careers/",
      segment: "wealth_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    {
      name: "St. James's Place",
      careersUrl: "https://careers.sjp.co.uk",
      segment: "wealth_manager",
      platformHint: "careers_page",
      sectorTag: "asset_management",
    },
    ],
  },
  accountancy_finance: {
    label: "Accountancy & Finance",
    segments: ["big4","mid_tier","consultancy"],
    employers: [
    {
      name: "Deloitte UK",
      careersUrl: "https://www.deloitte.com/uk/en/careers.html",
      segment: "big4",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "PwC UK",
      careersUrl: "https://www.pwc.co.uk/careers.html",
      segment: "big4",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "KPMG UK",
      careersUrl: "https://www.kpmgcareers.co.uk",
      segment: "big4",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "EY UK",
      careersUrl: "https://www.ey.com/en_uk/careers",
      segment: "big4",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "BDO UK",
      careersUrl: "https://careers.bdo.co.uk",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Grant Thornton UK",
      careersUrl: "https://www.grantthornton.co.uk/careers/",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "RSM UK",
      careersUrl: "https://www.rsmuk.com/careers",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Forvis Mazars",
      careersUrl: "https://www.forvismazars.com/uk/en/careers",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Crowe UK",
      careersUrl: "https://www.crowe.com/uk/careers",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Saffery",
      careersUrl: "https://www.saffery.com/careers/",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Moore Kingston Smith",
      careersUrl: "https://mks.co.uk/careers/",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Menzies",
      careersUrl: "https://www.menzies.co.uk/careers/",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Azets",
      careersUrl: "https://www.azets.co.uk/careers/",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Buzzacott",
      careersUrl: "https://www.buzzacott.co.uk/careers",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Price Bailey",
      careersUrl: "https://www.pricebailey.co.uk/careers/",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    {
      name: "Bishop Fleming",
      careersUrl: "https://www.bishopfleming.co.uk/careers",
      segment: "mid_tier",
      platformHint: "careers_page",
      sectorTag: "accountancy_finance",
    },
    ],
  },
  it_tech: {
    label: "IT & Technology",
    segments: ["fintech","software","consultancy"],
    employers: [
    {
      name: "Wise",
      careersUrl: "https://www.wise.jobs",
      segment: "fintech",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Checkout.com",
      careersUrl: "https://www.checkout.com/careers",
      segment: "fintech",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "GoCardless",
      careersUrl: "https://gocardless.com/about/jobs/",
      segment: "fintech",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Thought Machine",
      careersUrl: "https://www.thoughtmachine.net/careers",
      segment: "fintech",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "ClearScore",
      careersUrl: "https://www.clearscore.com/careers",
      segment: "fintech",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Tide",
      careersUrl: "https://www.tide.co/careers/",
      segment: "fintech",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Zilch",
      careersUrl: "https://www.zilch.com/uk/careers/",
      segment: "fintech",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Multiverse",
      careersUrl: "https://jobs.ashbyhq.com/multiverse",
      segment: "software",
      platformHint: "ashby",
      sectorTag: "it_tech",
    },
    {
      name: "Octopus Energy Group",
      careersUrl: "https://jobs.lever.co/octoenergy",
      segment: "software",
      platformHint: "lever",
      sectorTag: "it_tech",
    },
    {
      name: "Snyk",
      careersUrl: "https://snyk.io/careers/",
      segment: "software",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Darktrace",
      careersUrl: "https://careers.darktrace.com",
      segment: "software",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Sage",
      careersUrl: "https://www.sage.com/en-gb/company/careers/",
      segment: "software",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Kainos",
      careersUrl: "https://careers.kainos.com",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Endava",
      careersUrl: "https://careers.endava.com",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "FDM Group",
      careersUrl: "https://www.fdmgroup.com/careers/",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    {
      name: "Softcat",
      careersUrl: "https://www.softcat.com/careers",
      segment: "consultancy",
      platformHint: "careers_page",
      sectorTag: "it_tech",
    },
    ],
  },
};

/** Seed rows that could not be included (e.g. no careers URL). */
export const CAREERS_DIRECTORY_SEED_UNRESOLVED: Array<{
  name: string;
  industry: string;
  segment: string;
  reason: string;
}> = [

];
