import { eq } from "drizzle-orm";
import {
  db,
  candidatesTable,
  jobSourcesTable,
  jobsTable,
  matchRunsTable,
  matchesTable,
  alertRulesTable,
  auditLogsTable,
  tenantsTable,
  tenantUsersTable,
  type Candidate,
} from "@workspace/db";
import { computeMatch } from "./matching";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const daysAgo = (n: number): Date =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAgo = (n: number): Date => new Date(Date.now() - n * 60 * 60 * 1000);

export async function ensureAuthSeed(): Promise<void> {
  if (
    process.env["NODE_ENV"] === "production" &&
    !process.env["SEED_DEMO_PASSWORD"]
  ) {
    logger.info(
      "Production without SEED_DEMO_PASSWORD; skipping demo tenant/user seed",
    );
    return;
  }

  const [existingTenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, "demo"))
    .limit(1);

  const tenant =
    existingTenant ??
    (
      await db
        .insert(tenantsTable)
        .values({ slug: "demo", name: "Demo Recruitment Agency" })
        .returning()
    )[0];
  if (!tenant) {
    throw new Error("Failed to ensure demo tenant");
  }

  const existingUsers = await db
    .select({ id: tenantUsersTable.id })
    .from(tenantUsersTable)
    .where(eq(tenantUsersTable.tenantId, tenant.id))
    .limit(1);
  if (existingUsers.length > 0) return;

  const password = process.env["SEED_DEMO_PASSWORD"] ?? "demo1234";
  const passwordHash = await hashPassword(password);

  await db.insert(tenantUsersTable).values([
    {
      tenantId: tenant.id,
      email: "owner@demo.test",
      fullName: "Olivia Owner",
      role: "owner",
      passwordHash,
    },
    {
      tenantId: tenant.id,
      email: "admin@demo.test",
      fullName: "Aaron Admin",
      role: "admin",
      passwordHash,
    },
    {
      tenantId: tenant.id,
      email: "recruiter@demo.test",
      fullName: "Rita Recruiter",
      role: "recruiter",
      passwordHash,
    },
    {
      tenantId: tenant.id,
      email: "viewer@demo.test",
      fullName: "Victor Viewer",
      role: "viewer",
      passwordHash,
    },
  ]);
  logger.info("Seeded demo tenant users (owner/admin/recruiter/viewer)");
}

export async function seedIfEmpty(): Promise<void> {
  if (
    process.env["NODE_ENV"] === "production" &&
    process.env["SEED_DEMO_DATA"] !== "true"
  ) {
    logger.info(
      "Production without SEED_DEMO_DATA=true; skipping demo data seed",
    );
    return;
  }

  const existing = await db.select().from(jobSourcesTable).limit(1);
  if (existing.length > 0) return;

  logger.info("Seeding VacancyMatch demo data");

  const sources = await db
    .insert(jobSourcesTable)
    .values([
      // Demo sources are sample data only (isDemo: true) — they are clearly
      // labeled in the Sources UI and never fetch anything from a live feed.
      {
        name: "Indeed Feed API",
        sourceType: "job_board_api",
        baseUrl: "https://api.indeed.com/ads",
        isActive: true,
        healthStatus: "healthy",
        lastSyncAt: hoursAgo(1),
        isDemo: true,
      },
      {
        name: "LinkedIn Jobs Crawler",
        sourceType: "crawler",
        baseUrl: "https://www.linkedin.com/jobs",
        isActive: true,
        healthStatus: "healthy",
        lastSyncAt: hoursAgo(3),
        isDemo: true,
      },
      {
        name: "Greenhouse Boards",
        sourceType: "ats_api",
        baseUrl: "https://boards-api.greenhouse.io",
        isActive: true,
        healthStatus: "degraded",
        lastSyncAt: hoursAgo(9),
        isDemo: true,
      },
      {
        name: "Workable Partner Feed",
        sourceType: "partner_feed",
        baseUrl: "https://www.workable.com/api",
        isActive: false,
        healthStatus: "error",
        lastSyncAt: daysAgo(4),
        isDemo: true,
      },
    ])
    .returning();

  const src = (i: number): string => sources[i]?.id ?? "";

  const jobs = await db
    .insert(jobsTable)
    .values([
      {
        sourceId: src(0),
        title: "Senior Frontend Engineer",
        companyName: "Monzo",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 85000,
        salaryMax: 105000,
        salaryCurrency: "GBP",
        industry: "Fintech",
        skills: ["React", "TypeScript", "GraphQL", "Testing", "CSS"],
        descriptionText:
          "Own end-to-end delivery of customer-facing banking features in a React/TypeScript stack alongside product and design.",
        applyUrl: "https://monzo.com/careers",
        postedAt: daysAgo(2),
        status: "active",
      },
      {
        sourceId: src(1),
        title: "Staff Software Engineer, Platform",
        companyName: "Wise",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 110000,
        salaryMax: 135000,
        salaryCurrency: "GBP",
        industry: "Fintech",
        skills: ["Java", "Kubernetes", "AWS", "Terraform", "PostgreSQL"],
        descriptionText:
          "Lead platform reliability and developer experience for hundreds of engineers building global payments infrastructure.",
        applyUrl: "https://wise.jobs",
        postedAt: daysAgo(5),
        status: "active",
      },
      {
        sourceId: src(0),
        title: "Frontend Engineer",
        companyName: "Deliveroo",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 65000,
        salaryMax: 80000,
        salaryCurrency: "GBP",
        industry: "Consumer Tech",
        skills: ["React", "TypeScript", "Redux", "CSS", "Accessibility"],
        descriptionText:
          "Build the consumer ordering experience used by millions weekly across web and mobile web.",
        applyUrl: "https://careers.deliveroo.co.uk",
        postedAt: daysAgo(1),
        status: "active",
      },
      {
        sourceId: src(1),
        title: "Senior Full-Stack Engineer",
        companyName: "Starling Bank",
        locationText: "Remote, UK",
        remoteType: "remote",
        employmentType: "full_time",
        salaryMin: 90000,
        salaryMax: 110000,
        salaryCurrency: "GBP",
        industry: "Fintech",
        skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS"],
        descriptionText:
          "Ship features across the stack for the UK's leading digital bank, from API design to polished UI.",
        applyUrl: "https://www.starlingbank.com/careers",
        postedAt: daysAgo(3),
        status: "active",
      },
      {
        sourceId: src(2),
        title: "Product Designer",
        companyName: "Figma",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 75000,
        salaryMax: 95000,
        salaryCurrency: "GBP",
        industry: "SaaS",
        skills: ["Figma", "Prototyping", "Design Systems", "User Research"],
        descriptionText:
          "Design core collaboration workflows with a highly technical product team.",
        applyUrl: "https://www.figma.com/careers",
        postedAt: daysAgo(6),
        status: "active",
      },
      {
        sourceId: src(0),
        title: "DevOps Engineer",
        companyName: "Octopus Energy",
        locationText: "Manchester, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 70000,
        salaryMax: 88000,
        salaryCurrency: "GBP",
        industry: "Energy",
        skills: ["Kubernetes", "AWS", "Terraform", "Python", "CI/CD"],
        descriptionText:
          "Scale the Kraken platform powering energy accounts for 50M+ customers worldwide.",
        applyUrl: "https://octopus.energy/careers",
        postedAt: daysAgo(8),
        status: "active",
      },
      {
        sourceId: src(1),
        title: "Data Scientist, Risk",
        companyName: "Revolut",
        locationText: "London, UK",
        remoteType: "remote",
        employmentType: "full_time",
        salaryMin: 80000,
        salaryMax: 100000,
        salaryCurrency: "GBP",
        industry: "Fintech",
        skills: ["Python", "SQL", "Machine Learning", "Spark", "Statistics"],
        descriptionText:
          "Build fraud and credit risk models across 45M retail customers.",
        applyUrl: "https://www.revolut.com/careers",
        postedAt: daysAgo(4),
        status: "active",
      },
      {
        sourceId: src(2),
        title: "Engineering Manager, Payments",
        companyName: "Checkout.com",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 120000,
        salaryMax: 145000,
        salaryCurrency: "GBP",
        industry: "Fintech",
        skills: ["Leadership", "Agile Delivery", "C#", "Cloud Architecture"],
        descriptionText:
          "Lead two squads owning card acquiring flows processing billions annually.",
        applyUrl: "https://www.checkout.com/careers",
        postedAt: daysAgo(11),
        status: "active",
      },
      {
        sourceId: src(0),
        title: "React Native Developer",
        companyName: "Babylon Health",
        locationText: "Birmingham, UK",
        remoteType: "remote",
        employmentType: "contract",
        salaryMin: 70000,
        salaryMax: 85000,
        salaryCurrency: "GBP",
        industry: "Healthcare",
        skills: ["React Native", "TypeScript", "React", "GraphQL", "Testing"],
        descriptionText:
          "Deliver patient-facing telehealth features in a regulated healthcare environment.",
        applyUrl: "https://www.babylonhealth.com/careers",
        postedAt: daysAgo(7),
        status: "active",
      },
      {
        sourceId: src(1),
        title: "Backend Engineer, Go",
        companyName: "Cloudflare",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 88000,
        salaryMax: 112000,
        salaryCurrency: "GBP",
        industry: "Infrastructure",
        skills: ["Go", "Distributed Systems", "Kafka", "PostgreSQL", "gRPC"],
        descriptionText:
          "Build control-plane services that configure one of the world's largest networks.",
        applyUrl: "https://www.cloudflare.com/careers",
        postedAt: daysAgo(2),
        status: "active",
      },
      {
        sourceId: src(2),
        title: "Senior Product Manager",
        companyName: "Spotify",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 95000,
        salaryMax: 120000,
        salaryCurrency: "GBP",
        industry: "Media",
        skills: ["Product Strategy", "A/B Testing", "Analytics", "Stakeholder Management"],
        descriptionText:
          "Own discovery experiences reaching hundreds of millions of listeners.",
        applyUrl: "https://www.lifeatspotify.com",
        postedAt: daysAgo(14),
        status: "active",
      },
      {
        sourceId: src(0),
        title: "Frontend Engineer, Design Systems",
        companyName: "GitLab",
        locationText: "Remote, EMEA",
        remoteType: "remote",
        employmentType: "full_time",
        salaryMin: 78000,
        salaryMax: 98000,
        salaryCurrency: "GBP",
        industry: "SaaS",
        skills: ["Vue.js", "TypeScript", "Design Systems", "CSS", "Accessibility"],
        descriptionText:
          "Evolve the Pajamas design system used across the entire GitLab product.",
        applyUrl: "https://about.gitlab.com/jobs",
        postedAt: daysAgo(9),
        status: "active",
      },
      {
        sourceId: src(1),
        title: "Machine Learning Engineer",
        companyName: "DeepMind",
        locationText: "London, UK",
        remoteType: "onsite",
        employmentType: "full_time",
        salaryMin: 105000,
        salaryMax: 140000,
        salaryCurrency: "GBP",
        industry: "AI Research",
        skills: ["Python", "PyTorch", "Machine Learning", "Distributed Systems"],
        descriptionText:
          "Productionize research models and build evaluation infrastructure.",
        applyUrl: "https://deepmind.google/careers",
        postedAt: daysAgo(3),
        status: "active",
      },
      {
        sourceId: src(0),
        title: "QA Automation Engineer",
        companyName: "Sky",
        locationText: "Leeds, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 48000,
        salaryMax: 60000,
        salaryCurrency: "GBP",
        industry: "Media",
        skills: ["Playwright", "TypeScript", "CI/CD", "API Testing"],
        descriptionText:
          "Own automated test coverage for streaming platform releases.",
        applyUrl: "https://careers.sky.com",
        postedAt: daysAgo(12),
        status: "active",
      },
      {
        sourceId: src(1),
        title: "Senior TypeScript Engineer, Developer Tools",
        companyName: "Vercel",
        locationText: "Remote, EMEA",
        remoteType: "remote",
        employmentType: "full_time",
        salaryMin: 95000,
        salaryMax: 125000,
        salaryCurrency: "GBP",
        industry: "SaaS",
        skills: ["TypeScript", "React", "Node.js", "Next.js", "Testing"],
        descriptionText:
          "Build the framework-defined infrastructure experience for millions of developers.",
        applyUrl: "https://vercel.com/careers",
        postedAt: hoursAgo(20),
        status: "active",
      },
      {
        sourceId: src(2),
        title: "Platform Engineer, Kubernetes",
        companyName: "Ocado Technology",
        locationText: "Hatfield, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 72000,
        salaryMax: 90000,
        salaryCurrency: "GBP",
        industry: "Retail Tech",
        skills: ["Kubernetes", "Go", "Terraform", "GCP", "Observability"],
        descriptionText:
          "Run the compute platform behind the world's most automated warehouses.",
        applyUrl: "https://careers.ocadogroup.com",
        postedAt: daysAgo(18),
        status: "active",
      },
      {
        sourceId: src(0),
        title: "Fullstack JavaScript Developer",
        companyName: "Moonpig",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 60000,
        salaryMax: 75000,
        salaryCurrency: "GBP",
        industry: "E-commerce",
        skills: ["React", "Node.js", "TypeScript", "GraphQL", "AWS"],
        descriptionText:
          "Ship personalization features across the gifting funnel.",
        applyUrl: "https://www.moonpig.com/careers",
        postedAt: daysAgo(10),
        status: "active",
      },
      {
        sourceId: src(1),
        title: "Security Engineer, AppSec",
        companyName: "Darktrace",
        locationText: "Cambridge, UK",
        remoteType: "onsite",
        employmentType: "full_time",
        salaryMin: 75000,
        salaryMax: 95000,
        salaryCurrency: "GBP",
        industry: "Cybersecurity",
        skills: ["Application Security", "Python", "Threat Modelling", "Cloud Security"],
        descriptionText:
          "Embed security into the SDLC of an AI-driven cyber defense platform.",
        applyUrl: "https://darktrace.com/careers",
        postedAt: daysAgo(21),
        status: "active",
      },
      // --- Pensions sector demo jobs ---
      {
        sourceId: src(0),
        title: "Pensions Consultant",
        companyName: "Mercer",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 55000,
        salaryMax: 75000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["Defined Benefit", "Actuarial", "Client Management", "Scheme Funding", "Trustee Advice"],
        descriptionText:
          "Advise DB and DC pension scheme trustees and sponsoring employers on funding, risk, and governance across a diverse client portfolio.",
        applyUrl: "https://www.mercer.com/careers",
        postedAt: daysAgo(3),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(1),
        title: "Senior Pensions Administrator",
        companyName: "Aptia Group",
        locationText: "Bristol, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 35000,
        salaryMax: 45000,
        salaryCurrency: "GBP",
        industry: "Pensions Administration",
        skills: ["Pensions Administration", "DB Calculations", "Member Communications", "Regulatory Compliance"],
        descriptionText:
          "Process complex DB member events, prepare benefit statements, and act as a technical reference point for junior administrators.",
        applyUrl: "https://www.aptia-group.com/careers",
        postedAt: daysAgo(5),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(2),
        title: "Scheme Actuary",
        companyName: "Barnett Waddingham",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 90000,
        salaryMax: 120000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["Actuarial Science", "Valuation", "Scheme Funding", "FRS 102", "Risk Management"],
        descriptionText:
          "Act as named Scheme Actuary for a portfolio of DB schemes, conducting triennial valuations and providing ongoing actuarial advice.",
        applyUrl: "https://www.barnett-waddingham.co.uk/careers",
        postedAt: daysAgo(7),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(0),
        title: "Pensions Actuary",
        companyName: "WTW",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 70000,
        salaryMax: 95000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["Actuarial Science", "Liability Modelling", "Risk Settlement", "Buy-in / Buyout", "Excel"],
        descriptionText:
          "Support senior actuaries on DB scheme valuations, longevity risk transactions, and liability-driven investment strategies.",
        applyUrl: "https://www.wtwco.com/en-gb/careers",
        postedAt: daysAgo(2),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(1),
        title: "DC Pensions Specialist",
        companyName: "Legal & General",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 50000,
        salaryMax: 68000,
        salaryCurrency: "GBP",
        industry: "Pensions & Insurance",
        skills: ["DC Governance", "Auto-Enrolment", "Member Engagement", "Investment Defaults"],
        descriptionText:
          "Support workplace DC scheme clients with governance, investment design, and member communication campaigns.",
        applyUrl: "https://www.legalandgeneralgroup.com/careers",
        postedAt: daysAgo(4),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(2),
        title: "Senior Actuarial Analyst",
        companyName: "Hymans Robertson",
        locationText: "Edinburgh, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 45000,
        salaryMax: 60000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["Actuarial Modelling", "Prophet", "LGPS", "Valuation", "VBA"],
        descriptionText:
          "Run actuarial models for LGPS fund clients and support the lead actuary through triennial valuations and funding strategy reviews.",
        applyUrl: "https://www.hymans.co.uk/careers",
        postedAt: daysAgo(6),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(0),
        title: "Pensions Lawyer",
        companyName: "Eversheds Sutherland",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 80000,
        salaryMax: 110000,
        salaryCurrency: "GBP",
        industry: "Legal",
        skills: ["Pensions Law", "Trustee Advisory", "Scheme Restructuring", "GMP Equalisation", "Regulatory"],
        descriptionText:
          "Advise trustees and sponsoring employers on DB scheme amendments, benefit changes, and regulatory compliance.",
        applyUrl: "https://www.eversheds-sutherland.com/global/en/careers",
        postedAt: daysAgo(9),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(1),
        title: "Pensions Administrator",
        companyName: "Trafalgar House",
        locationText: "Manchester, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 28000,
        salaryMax: 36000,
        salaryCurrency: "GBP",
        industry: "Pensions Administration",
        skills: ["Pensions Administration", "DB Benefits", "Member Queries", "Process Improvement"],
        descriptionText:
          "Administer a portfolio of DB and DC schemes, handling retirement calculations, transfers, and member correspondence.",
        applyUrl: "https://www.trafalgarhouse.com/careers",
        postedAt: daysAgo(1),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(2),
        title: "Investment Consultant",
        companyName: "LCP",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 60000,
        salaryMax: 85000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["Investment Strategy", "LDI", "Manager Selection", "DB Pension Funds", "ESG"],
        descriptionText:
          "Provide investment strategy and manager selection advice to DB pension trustees, with a focus on de-risking and journey planning.",
        applyUrl: "https://www.lcp.uk.com/careers",
        postedAt: daysAgo(11),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(0),
        title: "Pensions Manager",
        companyName: "Aviva",
        locationText: "Norwich, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 60000,
        salaryMax: 78000,
        salaryCurrency: "GBP",
        industry: "Pensions & Insurance",
        skills: ["Pensions Governance", "DC Workplace", "Trustee Liaison", "TPR Compliance"],
        descriptionText:
          "Oversee governance and operational management of Aviva workplace DC schemes, liaising with trustees and regulators.",
        applyUrl: "https://careers.aviva.co.uk",
        postedAt: daysAgo(8),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(1),
        title: "Pensions Administrator",
        companyName: "XPS Group",
        locationText: "Reading, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 27000,
        salaryMax: 35000,
        salaryCurrency: "GBP",
        industry: "Pensions Administration",
        skills: ["Pensions Administration", "Calculations", "Member Services", "GDPR"],
        descriptionText:
          "Handle day-to-day administration of DB and hybrid pension schemes from new-joiner processing through to retirement.",
        applyUrl: "https://www.xpsgroup.com/careers",
        postedAt: daysAgo(13),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(2),
        title: "Pensions Consultant",
        companyName: "Aon",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 52000,
        salaryMax: 72000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["DB Consulting", "Trustee Advisory", "Employer Covenant", "Actuarial", "Client Management"],
        descriptionText:
          "Work alongside actuaries and investment consultants to deliver holistic risk management advice to DB scheme clients.",
        applyUrl: "https://www.aon.com/en-gb/careers",
        postedAt: daysAgo(4),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(0),
        title: "Senior Pensions Consultant",
        companyName: "Isio",
        locationText: "Leeds, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 65000,
        salaryMax: 88000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["DB Scheme Management", "Actuarial", "Funding Negotiations", "Trustee Advisory"],
        descriptionText:
          "Lead client relationships on a portfolio of medium-to-large DB schemes, driving funding strategy and risk reduction outcomes.",
        applyUrl: "https://isio.com/careers",
        postedAt: daysAgo(6),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(1),
        title: "Pensions Technician",
        companyName: "Buck",
        locationText: "Glasgow, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 30000,
        salaryMax: 40000,
        salaryCurrency: "GBP",
        industry: "Pensions Administration",
        skills: ["Pensions Calculations", "DB Administration", "Excel", "Regulatory Compliance"],
        descriptionText:
          "Provide technical checking and quality assurance for complex DB benefit calculations and member communications.",
        applyUrl: "https://www.buck.com/careers",
        postedAt: daysAgo(10),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(2),
        title: "Pension Fund Manager",
        companyName: "LGPS Central",
        locationText: "Wolverhampton, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 75000,
        salaryMax: 100000,
        salaryCurrency: "GBP",
        industry: "LGPS",
        skills: ["Fund Management", "Investment Management", "LGPS", "ESG", "Alternatives"],
        descriptionText:
          "Manage pooled investment mandates on behalf of LGPS Central partner funds, covering equities, fixed income, and alternatives.",
        applyUrl: "https://www.lgpscentral.co.uk/careers",
        postedAt: daysAgo(15),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(0),
        title: "Defined Benefit Analyst",
        companyName: "Spence & Partners",
        locationText: "Belfast, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 38000,
        salaryMax: 52000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["Actuarial Modelling", "Valuation", "DB Schemes", "Excel", "Prophet"],
        descriptionText:
          "Support actuarial consultants on DB valuations, liability monitoring, and funding reports for Northern Ireland and GB clients.",
        applyUrl: "https://www.spenceandpartners.co.uk/careers",
        postedAt: daysAgo(12),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(1),
        title: "Pensions Risk Analyst",
        companyName: "Pension Insurance Corporation",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 55000,
        salaryMax: 75000,
        salaryCurrency: "GBP",
        industry: "Bulk Annuities",
        skills: ["Risk Modelling", "Longevity Risk", "Actuarial", "SQL", "Python"],
        descriptionText:
          "Model longevity, investment, and operational risks within the PIC annuity book supporting pricing and capital decisions.",
        applyUrl: "https://www.pensioncorporation.com/careers",
        postedAt: daysAgo(3),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(2),
        title: "Pensions Administrator",
        companyName: "Mercer",
        locationText: "Birmingham, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 26000,
        salaryMax: 34000,
        salaryCurrency: "GBP",
        industry: "Pensions Administration",
        skills: ["DB Administration", "Member Services", "Benefit Calculations", "Trustee Reporting"],
        descriptionText:
          "Administer defined benefit pension schemes end-to-end, handling retirements, deaths, transfers, and member correspondence.",
        applyUrl: "https://www.mercer.com/careers",
        postedAt: daysAgo(2),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(0),
        title: "Senior Pensions Administrator",
        companyName: "XPS Group",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 38000,
        salaryMax: 48000,
        salaryCurrency: "GBP",
        industry: "Pensions Administration",
        skills: ["DB Administration", "Technical Checking", "Member Communications", "Mentoring"],
        descriptionText:
          "Act as technical lead on a client team, checking complex calculations and mentoring junior administrators.",
        applyUrl: "https://www.xpsgroup.com/careers",
        postedAt: daysAgo(8),
        status: "active",
        sectorTag: "pensions",
      },
      {
        sourceId: src(1),
        title: "Pensions Consultant",
        companyName: "Buck",
        locationText: "London, UK",
        remoteType: "hybrid",
        employmentType: "full_time",
        salaryMin: 50000,
        salaryMax: 68000,
        salaryCurrency: "GBP",
        industry: "Pensions Consulting",
        skills: ["DB Consulting", "Employer Covenant", "Scheme Funding", "Member Communications", "Excel"],
        descriptionText:
          "Advise sponsoring employers and trustees on scheme funding, benefit design, and compliance with TPR requirements.",
        applyUrl: "https://www.buck.com/careers",
        postedAt: daysAgo(5),
        status: "active",
        sectorTag: "pensions",
      },
    ])
    .returning();

  const candidates = await db
    .insert(candidatesTable)
    .values([
      {
        firstName: "Amelia",
        lastName: "Clarke",
        email: "amelia.clarke@example.com",
        phone: "+44 7700 900123",
        currentTitle: "Senior Frontend Engineer",
        currentCompany: "ASOS",
        locationText: "London, UK",
        summary:
          "Senior frontend engineer with 8 years building consumer-scale React applications in e-commerce and fintech. Led migration to TypeScript and design-system adoption across four squads.",
        seniority: "senior",
        skills: [
          "React",
          "TypeScript",
          "GraphQL",
          "CSS",
          "Testing",
          "Next.js",
          "Node.js",
          "Design Systems",
          "Accessibility",
        ],
        titles: ["Senior Frontend Engineer", "Frontend Engineer", "Web Developer"],
        industries: ["E-commerce", "Fintech"],
        remotePreference: "hybrid",
        desiredSalaryMin: 85000,
        desiredSalaryMax: 100000,
        salaryCurrency: "GBP",
        cvFileName: "amelia-clarke-cv.txt",
        status: "active",
      },
      {
        firstName: "Rajan",
        lastName: "Patel",
        email: "rajan.patel@example.com",
        phone: "+44 7700 900456",
        currentTitle: "DevOps Engineer",
        currentCompany: "BT Group",
        locationText: "Manchester, UK",
        summary:
          "Infrastructure engineer with 6 years across telecoms and retail, specializing in Kubernetes platform builds, Terraform-managed AWS estates, and CI/CD modernization.",
        seniority: "mid",
        skills: [
          "Kubernetes",
          "AWS",
          "Terraform",
          "Python",
          "CI/CD",
          "Docker",
          "Observability",
          "Linux",
        ],
        titles: ["DevOps Engineer", "Site Reliability Engineer", "Systems Administrator"],
        industries: ["Telecoms", "Retail Tech", "Energy"],
        remotePreference: "hybrid",
        desiredSalaryMin: 70000,
        desiredSalaryMax: 85000,
        salaryCurrency: "GBP",
        cvFileName: "rajan-patel-cv.txt",
        status: "active",
      },
      {
        firstName: "Sofia",
        lastName: "Novak",
        email: "sofia.novak@example.com",
        currentTitle: "Data Scientist",
        currentCompany: "Lloyds Banking Group",
        locationText: "London, UK",
        summary:
          "Data scientist with 5 years in banking risk and fraud analytics. Ships production ML models end-to-end and partners closely with engineering on model serving.",
        seniority: "mid",
        skills: [
          "Python",
          "SQL",
          "Machine Learning",
          "Statistics",
          "Spark",
          "PyTorch",
          "dbt",
        ],
        titles: ["Data Scientist", "Data Analyst"],
        industries: ["Fintech", "Banking"],
        remotePreference: "remote",
        desiredSalaryMin: 78000,
        desiredSalaryMax: 95000,
        salaryCurrency: "GBP",
        cvFileName: "sofia-novak-cv.txt",
        status: "active",
      },
    ])
    .returning();

  // Run initial matching for each seeded candidate
  const activeSourceIds = new Set(
    sources.filter((s) => s.isActive).map((s) => s.id),
  );
  const activeJobs = jobs.filter(
    (j) => j.sourceId && activeSourceIds.has(j.sourceId),
  );
  const now = new Date();

  for (const candidate of candidates as Candidate[]) {
    const startedAt = hoursAgo(2);
    const [run] = await db
      .insert(matchRunsTable)
      .values({
        candidateId: candidate.id,
        triggerType: "cv_upload",
        status: "completed",
        matchCount: 0,
        startedAt,
        completedAt: startedAt,
      })
      .returning();
    if (!run) continue;
    const computed = activeJobs
      .map((job) => ({ job, result: computeMatch(candidate, job, now) }))
      .filter(({ result }) => result.overallScore >= 30)
      .sort((a, b) => b.result.overallScore - a.result.overallScore)
      .slice(0, 25);
    if (computed.length > 0) {
      await db.insert(matchesTable).values(
        computed.map(({ job, result }) => ({
          matchRunId: run.id,
          candidateId: candidate.id,
          jobId: job.id,
          overallScore: result.overallScore,
          scoreBreakdown: result.scoreBreakdown,
          explanation: result.explanation,
          matchedSkills: result.matchedSkills,
          missingSkills: result.missingSkills,
        })),
      );
    }
    await db
      .update(matchRunsTable)
      .set({ matchCount: computed.length })
      .where(eq(matchRunsTable.id, run.id));
    await db
      .update(candidatesTable)
      .set({
        lastMatchedAt: startedAt,
        bestMatchScore: computed[0]?.result.overallScore ?? null,
        matchCount: computed.length,
      })
      .where(eq(candidatesTable.id, candidate.id));
  }

  const firstCandidate = candidates[0];
  if (firstCandidate) {
    await db.insert(alertRulesTable).values({
      candidateId: firstCandidate.id,
      minScore: 75,
      frequency: "daily",
      isActive: true,
      lastCheckedAt: hoursAgo(1),
    });
  }

  await db.insert(auditLogsTable).values([
    {
      actorName: "System",
      action: "workspace.seeded",
      entityType: "system",
      metadata: "Demo workspace initialized with sources, jobs and candidates",
      createdAt: hoursAgo(3),
    },
    ...candidates.map((c) => ({
      actorName: "Demo Recruiter",
      action: "candidate.cv_parsed",
      entityType: "candidate",
      entityId: c.id,
      metadata: `CV "${c.cvFileName ?? "cv.txt"}" parsed into profile for ${c.firstName} ${c.lastName}`,
      createdAt: hoursAgo(2),
    })),
    ...candidates.map((c) => ({
      actorName: "Demo Recruiter",
      action: "match_run.executed",
      entityType: "match_run",
      entityId: c.id,
      metadata: `Initial market scan completed for ${c.firstName} ${c.lastName}`,
      createdAt: hoursAgo(2),
    })),
  ]);

  logger.info(
    { sources: sources.length, jobs: jobs.length, candidates: candidates.length },
    "Seed complete",
  );
}

