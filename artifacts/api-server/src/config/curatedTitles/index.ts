import type { CuratedTitleEntry } from "./types";
import { INSURANCE_TITLES } from "./insurance";
import { BANKING_TITLES } from "./banking";
import { PENSIONS_TITLES } from "./pensions";
import { FUND_MANAGER_TITLES } from "./fundManagers";
import { ASSET_MANAGEMENT_REAL_ASSETS_TITLES } from "./assetManagementRealAssets";
import { ACCOUNTANCY_FINANCE_TITLES } from "./accountancyFinance";

export type { CuratedTitleEntry } from "./types";

/**
 * All curated titles across industries. Add new industry files (banking.ts,
 * pensions.ts, …) and spread them here — nothing else needs to change.
 */
export const CURATED_TITLES: CuratedTitleEntry[] = [
  ...INSURANCE_TITLES,
  ...BANKING_TITLES,
  ...PENSIONS_TITLES,
  ...FUND_MANAGER_TITLES,
  ...ASSET_MANAGEMENT_REAL_ASSETS_TITLES,
  ...ACCOUNTANCY_FINANCE_TITLES,
];
