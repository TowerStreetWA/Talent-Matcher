import type { FinSector, FinFunction } from "../../lib/search/finTaxonomy";

/**
 * Display families: the recruiter-facing family/function filters shown on the
 * Job Search page, per sector. Pure configuration — labels and groupings can
 * change here without touching search logic.
 *
 * Each display family maps to the underlying taxonomy two ways:
 *  - `families`: classifyVacancy FinFunction values (job.fn must be one of them)
 *  - `tags`: curated-title entry tags (the job's curated entry must carry one)
 * A job matches a display family when EITHER mapping hits (OR semantics),
 * so tag-level granularity (e.g. "investment_banking") works alongside the
 * coarser FinFunction families.
 *
 * Only families that actually exist in the curated taxonomy for that sector
 * are listed — verified by displayFamilies tests against CURATED_TITLES.
 */
export interface DisplayFamily {
  /** Stable key used in API params, URLs and saved searches. */
  key: string;
  /** Human-friendly label shown in the UI. */
  label: string;
  /** classifyVacancy FinFunction values that fall under this display family. */
  families: FinFunction[];
  /** Curated-title tags that fall under this display family. */
  tags: string[];
}

export const DISPLAY_FAMILIES: Record<FinSector, DisplayFamily[]> = {
  insurance: [
    { key: "underwriting", label: "Underwriting", families: ["underwriting"], tags: [] },
    { key: "claims", label: "Claims", families: ["claims"], tags: [] },
    {
      key: "broking_distribution",
      label: "Broking & Distribution",
      families: ["broking"],
      tags: ["sales_account_management"],
    },
    {
      key: "risk_compliance",
      label: "Risk & Compliance",
      families: ["risk", "compliance", "actuarial"],
      tags: [],
    },
    {
      key: "product_marketing",
      label: "Product & Marketing",
      families: [],
      tags: ["product_marketing"],
    },
    {
      key: "operations_admin",
      label: "Operations & Admin",
      families: ["operations", "client_service"],
      tags: [],
    },
    {
      key: "finance_investment",
      label: "Finance & Investment",
      families: ["finance", "investments"],
      tags: ["finance_investment"],
    },
    {
      key: "tech_change",
      label: "Tech & Change",
      families: [],
      tags: ["data_change_technology"],
    },
  ],
  banking: [
    {
      key: "relationship_management",
      label: "Relationship Management",
      families: [],
      tags: ["relationship_management"],
    },
    { key: "branch_network", label: "Branch Network", families: [], tags: ["branch_network"] },
    {
      key: "credit_lending",
      label: "Credit & Lending",
      families: ["underwriting"],
      tags: ["credit_lending"],
    },
    {
      key: "investment_banking",
      label: "Investment Banking",
      families: [],
      tags: ["investment_banking"],
    },
    {
      key: "treasury_balance_sheet",
      label: "Treasury & Balance Sheet",
      families: [],
      tags: ["treasury_balance_sheet"],
    },
    {
      key: "risk",
      label: "Risk",
      families: ["risk"],
      tags: ["credit_risk", "market_risk", "risk_modelling"],
    },
    {
      key: "compliance_financial_crime",
      label: "Compliance & Financial Crime",
      families: ["compliance"],
      tags: ["compliance_financial_crime", "internal_audit"],
    },
    {
      key: "payments_transaction_banking",
      label: "Payments & Transaction Banking",
      families: [],
      tags: ["payments_transaction_banking"],
    },
    {
      key: "operations_middle_back_office",
      label: "Ops & Middle/Back Office",
      families: ["operations"],
      tags: ["operations_middle_back_office"],
    },
    {
      key: "digital_change",
      label: "Digital & Change",
      families: [],
      tags: ["digital_product_change"],
    },
    {
      key: "contact_centre_collections",
      label: "Contact Centre & Collections",
      families: [],
      tags: ["contact_centre_collections"],
    },
    {
      key: "leadership",
      label: "Leadership",
      families: [],
      tags: ["executive_leadership"],
    },
  ],
  pensions: [
    {
      key: "administration_operations",
      label: "Administration & Operations",
      families: ["pensions_admin", "operations"],
      tags: ["administration_operations"],
    },
    {
      key: "consulting_advice",
      label: "Consulting & Advice",
      families: [],
      tags: ["consulting_advice"],
    },
    {
      key: "actuarial_risk",
      label: "Actuarial & Risk",
      families: ["actuarial", "risk"],
      tags: ["actuarial_risk", "de_risking"],
    },
    {
      key: "investment_ldi",
      label: "Investment & LDI",
      families: ["investments"],
      tags: ["investment_ldi"],
    },
    {
      key: "policy_regulation_compliance",
      label: "Policy, Regulation & Compliance",
      families: ["compliance"],
      tags: ["policy_regulation_compliance"],
    },
    {
      key: "member_services_comms",
      label: "Member Services & Comms",
      families: ["client_service"],
      tags: ["member_services_communications"],
    },
    {
      key: "reporting_systems",
      label: "Reporting & Systems",
      families: [],
      tags: ["reporting_change_systems"],
    },
    {
      key: "leadership",
      label: "Leadership",
      families: [],
      tags: ["executive_leadership"],
    },
  ],
  asset_management: [
    {
      key: "portfolio_management",
      label: "Portfolio Management",
      families: [],
      tags: ["portfolio_management"],
    },
    {
      key: "research_analysis",
      label: "Research & Analysis",
      families: [],
      tags: ["research_analysis"],
    },
    {
      key: "trading_dealing",
      label: "Trading & Dealing",
      families: [],
      tags: ["trading_dealing"],
    },
    {
      key: "client_sales_distribution",
      label: "Client Sales & Distribution",
      families: ["client_service"],
      tags: ["client_sales_distribution"],
    },
    {
      key: "risk_performance",
      label: "Risk & Performance",
      families: ["risk"],
      tags: ["risk_performance"],
    },
    {
      key: "compliance_operations",
      label: "Compliance & Operations",
      families: ["compliance", "operations"],
      tags: ["compliance_operations", "operations_middle_back_office"],
    },
    {
      key: "real_assets_infrastructure",
      label: "Real Assets & Infrastructure",
      families: [],
      tags: ["real_assets_investment"],
    },
    {
      key: "institutional_client_sales",
      label: "Institutional Client Sales",
      families: [],
      tags: ["institutional_client_sales"],
    },
    {
      key: "finance_control",
      label: "Finance & Control",
      families: ["finance"],
      tags: ["finance_control"],
    },
    {
      key: "esg_stewardship",
      label: "ESG & Stewardship",
      families: [],
      tags: ["esg"],
    },
    {
      key: "leadership",
      label: "Leadership",
      families: [],
      tags: ["executive_leadership"],
    },
  ],
  accountancy_finance: [
    {
      key: "audit_assurance",
      label: "Audit & Assurance",
      families: [],
      tags: ["audit_assurance", "forensic"],
    },
    { key: "tax", label: "Tax", families: [], tags: ["tax"] },
    {
      key: "accounts_bookkeeping_payroll",
      label: "Accounts, Bookkeeping & Payroll",
      families: [],
      tags: ["accounts_bookkeeping_payroll"],
    },
    {
      key: "financial_reporting",
      label: "Financial Reporting",
      families: [],
      tags: ["financial_reporting"],
    },
    {
      key: "fpa_commercial",
      label: "FP&A & Commercial Finance",
      families: [],
      tags: ["fpa_commercial"],
    },
    {
      key: "treasury_corporate_finance",
      label: "Treasury & Corporate Finance",
      families: [],
      tags: ["treasury_corporate_finance"],
    },
    {
      key: "credit_billing_ar_ap",
      label: "Credit, Billing, AR & AP",
      families: [],
      tags: ["credit_billing_ar_ap"],
    },
    {
      key: "finance_systems_change",
      label: "Finance Systems & Change",
      families: [],
      tags: ["finance_systems_change"],
    },
    {
      key: "practice",
      label: "Practice (Partner Track)",
      families: [],
      tags: ["practice"],
    },
    {
      key: "leadership",
      label: "Leadership",
      families: [],
      tags: ["executive_leadership"],
    },
  ],
  it_tech: [
    {
      key: "software_engineering",
      label: "Software Engineering",
      families: ["software_engineering"],
      tags: [],
    },
    {
      key: "cloud_infrastructure",
      label: "Cloud & Infrastructure",
      families: ["cloud_infrastructure"],
      tags: [],
    },
    { key: "devops_sre", label: "DevOps & SRE", families: ["devops_sre"], tags: [] },
    {
      key: "data_engineering",
      label: "Data Engineering",
      families: ["data_engineering"],
      tags: [],
    },
    { key: "data_analytics", label: "Data & Analytics", families: ["data_analytics"], tags: [] },
    {
      key: "data_science_ml_ai",
      label: "Data Science, ML & AI",
      families: ["data_science_ml_ai"],
      tags: [],
    },
    { key: "cyber_security", label: "Cyber Security", families: ["cyber_security"], tags: [] },
    {
      key: "it_operations_service",
      label: "IT Operations & Service",
      families: ["it_operations_service"],
      tags: [],
    },
    {
      key: "end_user_support",
      label: "End-User Support",
      families: ["end_user_support"],
      tags: [],
    },
    {
      key: "business_systems_analysis",
      label: "Business & Systems Analysis",
      families: ["business_systems_analysis"],
      tags: [],
    },
    {
      key: "product_management_tech",
      label: "Product Management",
      families: ["product_management_tech"],
      tags: [],
    },
    {
      key: "project_delivery_agile",
      label: "Project & Delivery",
      families: ["project_delivery_agile"],
      tags: [],
    },
    { key: "ux_design", label: "UX & Design", families: ["ux_design"], tags: [] },
    { key: "quality_assurance", label: "QA & Testing", families: ["quality_assurance"], tags: [] },
    {
      key: "solutions_presales",
      label: "Solutions & Pre-Sales",
      families: ["solutions_presales"],
      tags: [],
    },
  ],
};

/** Display families available for a sector (empty array for unknown input). */
export function displayFamiliesForSector(sector: FinSector): DisplayFamily[] {
  return DISPLAY_FAMILIES[sector] ?? [];
}

/**
 * Resolve a family key to its DisplayFamily. When `sector` is provided only
 * that sector's families are searched; otherwise all sectors are.
 */
export function resolveDisplayFamily(
  key: string,
  sector: FinSector | null,
): DisplayFamily | null {
  return resolveDisplayFamilies(key, sector)[0] ?? null;
}

/**
 * Resolve a family key to ALL matching DisplayFamily definitions. Keys can be
 * reused across sectors (e.g. "leadership"); when `sector` is null every
 * sector's definition of the key is returned so filtering ORs across all of
 * them rather than depending on object iteration order.
 */
export function resolveDisplayFamilies(
  key: string,
  sector: FinSector | null,
): DisplayFamily[] {
  const pools = sector ? [DISPLAY_FAMILIES[sector]] : Object.values(DISPLAY_FAMILIES);
  const out: DisplayFamily[] = [];
  for (const pool of pools) {
    const found = pool.find((df) => df.key === key);
    if (found) out.push(found);
  }
  return out;
}

/**
 * Whether a job (classified fn + curated-entry tags) falls under a display
 * family. OR semantics across the two mappings.
 */
export function matchesDisplayFamily(
  df: DisplayFamily,
  fn: string | null,
  curatedTags: readonly string[],
): boolean {
  if (fn && (df.families as readonly string[]).includes(fn)) return true;
  return df.tags.some((t) => curatedTags.includes(t));
}
