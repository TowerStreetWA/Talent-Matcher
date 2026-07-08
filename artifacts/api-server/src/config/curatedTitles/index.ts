import type { CuratedTitleEntry } from "./types";
import { INSURANCE_TITLES } from "./insurance";

export type { CuratedTitleEntry } from "./types";

/**
 * All curated titles across industries. Add new industry files (banking.ts,
 * pensions.ts, …) and spread them here — nothing else needs to change.
 */
export const CURATED_TITLES: CuratedTitleEntry[] = [...INSURANCE_TITLES];
