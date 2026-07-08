import type { CuratedTitleEntry } from "./types";

/**
 * Curated asset-management REAL ASSETS / INFRASTRUCTURE / broader buy-side
 * platform titles — complements fundManagers.ts (same industry:
 * "asset_management").
 *
 * OVERLAP RULE: titles that also appear in the fund-managers supplied list
 * (CEO (Asset Management), Deputy CIO, Head of Alternatives, Head of ESG,
 * Head of Distribution, RFP Writer/Specialist, Investment Writer, Product
 * Development Manager) are defined ONCE in fundManagers.ts with this list's
 * phrasings as variants — do not redefine them here.
 *
 * FALSE-POSITIVE RULE: titles shared with real-estate/property or general
 * industry (e.g. "Asset Manager", "Portfolio Director", "CRM Manager",
 * "Marketing Director") are only included with a real-assets/investment
 * qualifier. Single-word variants only match exactly.
 *
 * PASTE ADDITIONAL TITLES HERE following the same shape.
 */
export const ASSET_MANAGEMENT_REAL_ASSETS_TITLES: CuratedTitleEntry[] = [
  // ── Executive leadership ─────────────────────────────────────────────────
  {
    industry: "asset_management",
    family: "operations",
    canonicalTitle: "Chief Operating Officer (Asset Management)",
    variants: ["chief operating officer asset management", "asset management coo"],
    seniority: "executive",
    tags: ["executive_leadership"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Head of Real Assets",
    variants: ["real assets director"],
    seniority: "executive",
    tags: ["executive_leadership", "real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Head of Real Estate Investments",
    variants: ["head of real estate investment", "real estate investments director"],
    seniority: "executive",
    tags: ["executive_leadership", "real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Head of Infrastructure Investments",
    variants: ["head of infrastructure investment", "infrastructure investments director"],
    seniority: "executive",
    tags: ["executive_leadership", "real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Head of Private Markets",
    variants: ["private markets director"],
    seniority: "executive",
    tags: ["executive_leadership", "real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Head of Private Equity",
    variants: ["private equity director"],
    seniority: "executive",
    tags: ["executive_leadership", "real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Head of Private Debt",
    variants: ["head of private credit", "private debt director"],
    seniority: "executive",
    tags: ["executive_leadership", "real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Head of Stewardship",
    variants: ["stewardship director"],
    seniority: "executive",
    tags: ["executive_leadership", "esg"],
  },
  {
    industry: "asset_management",
    family: "risk",
    canonicalTitle: "Head of Investment Risk",
    variants: ["investment risk director"],
    seniority: "executive",
    tags: ["executive_leadership", "risk_performance"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Head of Product (Asset Management)",
    variants: ["head of product asset management", "head of fund products"],
    seniority: "executive",
    tags: ["executive_leadership", "product_marketing"],
  },

  // ── Real assets investment ───────────────────────────────────────────────
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Real Estate Portfolio Manager",
    variants: ["property portfolio manager", "real estate fund manager"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Infrastructure Portfolio Manager",
    variants: ["infrastructure fund manager"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Private Equity Portfolio Manager",
    variants: ["private equity fund manager"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Private Debt Portfolio Manager",
    variants: ["private debt fund manager", "private credit portfolio manager"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Alternatives Portfolio Manager",
    variants: ["alternatives fund manager", "alternative investments portfolio manager"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Real Assets Portfolio Manager",
    variants: ["real assets fund manager"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Senior Investment Manager (Real Assets)",
    variants: ["senior investment manager real assets", "real assets investment manager"],
    seniority: "senior",
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Investment Director (Asset Management)",
    variants: ["investment director asset management"],
    seniority: "senior",
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Associate Director (Asset Management)",
    variants: ["associate director asset management", "associate investment director"],
    seniority: "senior",
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Investment Associate (Asset Management)",
    variants: ["investment associate asset management", "investments associate"],
    seniority: "junior",
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Investment Analyst (Real Estate)",
    variants: ["investment analyst real estate", "real estate investment analyst"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Investment Analyst (Infrastructure)",
    variants: ["investment analyst infrastructure", "infrastructure investment analyst"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Investment Analyst (Private Equity)",
    variants: ["investment analyst private equity", "private equity investment analyst", "private equity analyst"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Investment Analyst (Private Debt)",
    variants: ["investment analyst private debt", "private debt investment analyst", "private credit analyst"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Asset Manager (Real Estate)",
    variants: ["real estate asset manager", "property asset manager"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Senior Asset Manager (Real Estate)",
    variants: ["senior real estate asset manager", "senior property asset manager"],
    seniority: "senior",
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Infrastructure Asset Manager",
    variants: ["infrastructure asset management analyst"],
    tags: ["real_assets_investment"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Portfolio Director (Real Assets)",
    variants: ["portfolio director real assets", "real assets portfolio director"],
    seniority: "senior",
    tags: ["real_assets_investment"],
  },

  // ── ESG & stewardship ────────────────────────────────────────────────────
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "ESG Investment Manager",
    variants: ["esg portfolio manager", "responsible investment manager"],
    tags: ["esg"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Responsible Investment Analyst",
    variants: ["responsible investing analyst"],
    tags: ["esg"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Stewardship Analyst",
    variants: ["investment stewardship analyst"],
    tags: ["esg"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Engagement Specialist (Asset Management)",
    variants: ["engagement specialist asset management", "corporate engagement analyst"],
    tags: ["esg"],
  },
  {
    industry: "asset_management",
    family: "investments",
    canonicalTitle: "Proxy Voting Analyst",
    variants: ["proxy voting specialist"],
    tags: ["esg"],
  },

  // ── Institutional client & sales ─────────────────────────────────────────
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Institutional Sales Manager (Asset Management)",
    variants: ["institutional sales manager asset management", "institutional sales manager"],
    tags: ["institutional_client_sales"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Institutional Business Development Manager",
    variants: ["institutional bdm"],
    tags: ["institutional_client_sales"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Consultant Relations Director",
    variants: ["consultant relations lead"],
    seniority: "senior",
    tags: ["institutional_client_sales"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Global Account Manager (Asset Management)",
    variants: ["global account manager asset management"],
    tags: ["institutional_client_sales"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Client Director (Institutional)",
    variants: ["client director institutional"],
    tags: ["institutional_client_sales"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Client Relationship Manager (Institutional)",
    variants: ["client relationship manager institutional", "institutional relationship manager"],
    tags: ["institutional_client_sales"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Client Service Associate (Asset Management)",
    variants: ["client service associate asset management", "client services associate asset management"],
    seniority: "junior",
    tags: ["institutional_client_sales"],
  },

  // ── Operations / middle & back office ────────────────────────────────────
  {
    industry: "asset_management",
    family: "operations",
    canonicalTitle: "Operations Manager (Asset Management)",
    variants: ["operations manager asset management", "investment operations manager"],
    tags: ["operations_middle_back_office"],
  },
  {
    industry: "asset_management",
    family: "operations",
    canonicalTitle: "Middle Office Manager (Asset Management)",
    variants: ["middle office manager asset management"],
    tags: ["operations_middle_back_office"],
  },
  {
    industry: "asset_management",
    family: "operations",
    canonicalTitle: "Collateral Management Analyst (Buy-Side)",
    variants: ["collateral management analyst buy side", "collateral analyst asset management"],
    tags: ["operations_middle_back_office"],
  },
  {
    industry: "asset_management",
    family: "operations",
    canonicalTitle: "Derivatives Operations Analyst",
    variants: ["derivative operations analyst", "otc operations analyst"],
    tags: ["operations_middle_back_office"],
  },
  {
    industry: "asset_management",
    family: "operations",
    canonicalTitle: "Onboarding Manager (Asset Management)",
    variants: ["onboarding manager asset management", "client onboarding manager asset management"],
    tags: ["operations_middle_back_office"],
  },
  {
    industry: "asset_management",
    family: "operations",
    canonicalTitle: "Client Onboarding Analyst (Asset Management)",
    variants: ["client onboarding analyst asset management", "onboarding analyst asset management"],
    tags: ["operations_middle_back_office"],
  },

  // ── Risk & performance ───────────────────────────────────────────────────
  {
    industry: "asset_management",
    family: "risk",
    canonicalTitle: "Investment Risk Manager",
    variants: ["investment risk lead"],
    tags: ["risk_performance"],
  },
  {
    industry: "asset_management",
    family: "risk",
    canonicalTitle: "Portfolio Risk Manager",
    variants: [],
    tags: ["risk_performance"],
  },
  {
    industry: "asset_management",
    family: "risk",
    canonicalTitle: "Liquidity Risk Manager (Asset Management)",
    variants: ["liquidity risk manager asset management", "fund liquidity risk manager"],
    tags: ["risk_performance"],
  },
  {
    industry: "asset_management",
    family: "risk",
    canonicalTitle: "Model Risk Analyst (Asset Management)",
    variants: ["model risk analyst asset management"],
    tags: ["risk_performance", "quant"],
  },
  {
    industry: "asset_management",
    family: "risk",
    canonicalTitle: "Performance & Risk Manager",
    variants: ["performance and risk manager", "risk and performance manager"],
    tags: ["risk_performance"],
  },

  // ── Product & marketing ──────────────────────────────────────────────────
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Senior Product Manager (Asset Management)",
    variants: ["senior product manager asset management", "senior fund product manager"],
    seniority: "senior",
    tags: ["product_marketing"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Marketing Director (Asset Management)",
    variants: ["marketing director asset management", "fund marketing director"],
    seniority: "senior",
    tags: ["product_marketing"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "Digital Marketing Manager (Asset Management)",
    variants: ["digital marketing manager asset management"],
    tags: ["product_marketing"],
  },
  {
    industry: "asset_management",
    family: "client_service",
    canonicalTitle: "CRM Manager (Asset Management)",
    variants: ["crm manager asset management"],
    tags: ["product_marketing"],
  },

  // ── Finance & control ────────────────────────────────────────────────────
  {
    industry: "asset_management",
    family: "finance",
    canonicalTitle: "Finance Manager (Asset Management)",
    variants: ["finance manager asset management"],
    tags: ["finance_control"],
  },
  {
    industry: "asset_management",
    family: "finance",
    canonicalTitle: "Fund Controller",
    variants: ["funds controller", "fund financial controller"],
    tags: ["finance_control"],
  },
  {
    industry: "asset_management",
    family: "finance",
    canonicalTitle: "Financial Controller (Asset Management)",
    variants: ["financial controller asset management"],
    tags: ["finance_control"],
  },
  {
    industry: "asset_management",
    family: "finance",
    canonicalTitle: "Management Accountant (Asset Management)",
    variants: ["management accountant asset management"],
    tags: ["finance_control"],
  },
  {
    industry: "asset_management",
    family: "finance",
    canonicalTitle: "FP&A Analyst (Asset Management)",
    variants: ["fp&a analyst asset management", "fpa analyst asset management"],
    tags: ["finance_control"],
  },
];
