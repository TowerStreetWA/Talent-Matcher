import type { Candidate, Job, ScoreBreakdown } from "@workspace/db";
import {
  classifyVacancy,
  inferCandidateFinProfile,
} from "./search/finClassify";
import { canonicalSkill } from "./search/insuranceSynonyms";

export type MatchComputation = {
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  explanation: string[];
  matchedSkills: string[];
  missingSkills: string[];
};

export const WEIGHTS = {
  skills: 0.35,
  title: 0.2,
  industry: 0.15,
  location: 0.15,
  comp: 0.1,
  recency: 0.05,
} as const;

const norm = (s: string): string => s.trim().toLowerCase();

const tokenize = (s: string): string[] =>
  norm(s)
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

const STOP_WORDS = new Set([
  "and",
  "or",
  "of",
  "the",
  "for",
  "with",
  "senior",
  "junior",
  "lead",
  "mid",
]);

const SENIORITY_TOKENS = ["senior", "junior", "lead", "principal", "head"];

function skillsScore(candidate: Candidate, job: Job) {
  // Normalise both sides through the insurance synonym index so that
  // e.g. "D&O" on a job and "Directors and Officers Liability" on a CV
  // are treated as the same skill.
  const normSkill = (s: string) => norm(canonicalSkill(s));
  const candSkills = new Set(candidate.skills.map(normSkill));
  const jobSkills = job.skills;
  if (jobSkills.length === 0) {
    return {
      score: 0.5,
      matched: [] as string[],
      missing: [] as string[],
      line: "Job lists no explicit skill requirements — neutral skills score applied",
    };
  }
  const matched = jobSkills.filter((s) => candSkills.has(normSkill(s)));
  const missing = jobSkills.filter((s) => !candSkills.has(normSkill(s)));
  const score = matched.length / jobSkills.length;
  const line =
    matched.length > 0
      ? `Candidate covers ${matched.length} of ${jobSkills.length} required skills (${matched.slice(0, 5).join(", ")}${matched.length > 5 ? ", …" : ""})`
      : `Candidate covers none of the ${jobSkills.length} required skills`;
  return { score, matched, missing, line };
}

function titleScore(candidate: Candidate, job: Job) {
  const candidateTitles = [
    ...(candidate.currentTitle ? [candidate.currentTitle] : []),
    ...candidate.titles,
  ];
  if (candidateTitles.length === 0) {
    return {
      score: 0.4,
      line: "No title history on candidate profile — partial title score applied",
    };
  }
  const jobTokens = new Set(tokenize(job.title));
  let best = 0;
  let bestTitle = candidateTitles[0] ?? "";
  for (const t of candidateTitles) {
    const candTokens = tokenize(t);
    if (candTokens.length === 0) continue;
    const overlap = candTokens.filter((tok) => jobTokens.has(tok)).length;
    const denom = Math.max(jobTokens.size, candTokens.length, 1);
    const sim = overlap / denom;
    if (sim > best) {
      best = sim;
      bestTitle = t;
    }
  }
  // Seniority alignment nudge
  const jobSeniority = SENIORITY_TOKENS.find((s) =>
    norm(job.title).includes(s),
  );
  const candSeniority = candidate.seniority ? norm(candidate.seniority) : null;
  if (jobSeniority && candSeniority && candSeniority.includes(jobSeniority)) {
    best = Math.min(1, best + 0.15);
  }
  const score = Math.min(1, best);
  const line =
    score >= 0.6
      ? `Strong title alignment: "${bestTitle}" closely matches "${job.title}"`
      : score >= 0.3
        ? `Partial title alignment between "${bestTitle}" and "${job.title}"`
        : `Weak title alignment — candidate's roles differ from "${job.title}"`;
  return { score, line };
}

function industryScore(candidate: Candidate, job: Job) {
  // Financial-services sector alignment takes precedence over free-text
  // industry comparison when both sides classify into the FS taxonomy.
  const jobFin = classifyVacancy(job);
  if (jobFin.sector) {
    const candFin = inferCandidateFinProfile(candidate);
    if (candFin.sector === jobFin.sector) {
      const fnAligned = jobFin.fn !== null && candFin.fn === jobFin.fn;
      const sectorLabel = jobFin.sector.replace("_", " ");
      return {
        score: 1,
        line: fnAligned
          ? `Sector match: both in ${sectorLabel} (${jobFin.fn?.replace("_", " ")} background aligns)`
          : `Sector match: candidate has ${sectorLabel} experience`,
      };
    }
    if (candFin.sector) {
      return {
        score: 0.2,
        line: `Sector gap: job is ${jobFin.sector.replace("_", " ")}, candidate background is ${candFin.sector.replace("_", " ")}`,
      };
    }
  }
  if (!job.industry) {
    return {
      score: 0.5,
      line: "Job has no industry tag — neutral industry score applied",
    };
  }
  const jobInd = norm(job.industry);
  const candInds = candidate.industries.map(norm);
  if (candInds.length === 0) {
    return {
      score: 0.4,
      line: "No industry history on candidate profile — partial industry score applied",
    };
  }
  if (candInds.some((i) => i === jobInd || i.includes(jobInd) || jobInd.includes(i))) {
    return {
      score: 1,
      line: `Industry match: candidate has ${job.industry} experience`,
    };
  }
  return {
    score: 0.2,
    line: `Industry gap: job is in ${job.industry}, candidate background is ${candidate.industries.slice(0, 3).join(", ")}`,
  };
}

function locationScore(candidate: Candidate, job: Job) {
  const jobRemote = job.remoteType ? norm(job.remoteType) : null;
  const candPref = candidate.remotePreference
    ? norm(candidate.remotePreference)
    : null;
  if (jobRemote === "remote") {
    return { score: 1, line: "Job is fully remote — location is not a constraint" };
  }
  const candLoc = candidate.locationText ? norm(candidate.locationText) : null;
  const jobLoc = job.locationText ? norm(job.locationText) : null;
  if (candLoc && jobLoc) {
    const candCity = candLoc.split(",")[0]?.trim() ?? candLoc;
    const jobCity = jobLoc.split(",")[0]?.trim() ?? jobLoc;
    if (candCity === jobCity || jobLoc.includes(candCity) || candLoc.includes(jobCity)) {
      return {
        score: 1,
        line: `Location match: both based around ${job.locationText}`,
      };
    }
    if (jobRemote === "hybrid") {
      return {
        score: 0.45,
        line: `Hybrid role in ${job.locationText}; candidate is in ${candidate.locationText} — commute may be a factor`,
      };
    }
    if (candPref === "remote") {
      return {
        score: 0.3,
        line: `Candidate prefers remote but role is on-site in ${job.locationText}`,
      };
    }
    return {
      score: 0.2,
      line: `Location gap: role is in ${job.locationText}, candidate is in ${candidate.locationText}`,
    };
  }
  return {
    score: 0.5,
    line: "Incomplete location data — neutral location score applied",
  };
}

function compScore(candidate: Candidate, job: Job) {
  const dMin = candidate.desiredSalaryMin;
  const dMax = candidate.desiredSalaryMax ?? dMin;
  const jMin = job.salaryMin;
  const jMax = job.salaryMax ?? jMin;
  if (dMin == null || jMax == null || jMin == null) {
    return {
      score: 0.5,
      line: "Salary data incomplete on one side — neutral compensation score applied",
    };
  }
  const cur = job.salaryCurrency ?? candidate.salaryCurrency ?? "";
  if (jMax >= (dMax ?? dMin)) {
    return {
      score: 1,
      line: `Compensation fits: job range up to ${cur} ${jMax.toLocaleString()} covers the candidate's target`,
    };
  }
  if (jMax >= dMin) {
    return {
      score: 0.7,
      line: `Compensation overlaps candidate's range but tops out at ${cur} ${jMax.toLocaleString()}`,
    };
  }
  const ratio = Math.max(0, Math.min(1, jMax / dMin));
  return {
    score: ratio * 0.5,
    line: `Compensation gap: job max ${cur} ${jMax.toLocaleString()} is below the candidate's minimum ${cur} ${dMin.toLocaleString()}`,
  };
}

function recencyScore(job: Job, now: Date) {
  if (!job.postedAt) {
    return { score: 0.4, line: "Posting date unknown — partial recency score applied" };
  }
  const days = Math.max(
    0,
    (now.getTime() - job.postedAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const d = Math.round(days);
  if (days <= 3) return { score: 1, line: `Fresh posting: listed ${d <= 0 ? "today" : `${d} day(s) ago`}` };
  if (days <= 7) return { score: 0.9, line: `Recent posting: listed ${d} days ago` };
  if (days <= 14) return { score: 0.75, line: `Posted ${d} days ago` };
  if (days <= 30) return { score: 0.5, line: `Aging posting: listed ${d} days ago` };
  if (days <= 60) return { score: 0.3, line: `Stale posting: listed ${d} days ago` };
  return { score: 0.15, line: `Very stale posting: listed ${d} days ago` };
}

export function computeMatch(
  candidate: Candidate,
  job: Job,
  now: Date = new Date(),
): MatchComputation {
  const sk = skillsScore(candidate, job);
  const ti = titleScore(candidate, job);
  const ind = industryScore(candidate, job);
  const loc = locationScore(candidate, job);
  const comp = compScore(candidate, job);
  const rec = recencyScore(job, now);

  const breakdown: ScoreBreakdown = {
    skills: round2(sk.score),
    title: round2(ti.score),
    industry: round2(ind.score),
    location: round2(loc.score),
    comp: round2(comp.score),
    recency: round2(rec.score),
  };

  const overall =
    breakdown.skills * WEIGHTS.skills +
    breakdown.title * WEIGHTS.title +
    breakdown.industry * WEIGHTS.industry +
    breakdown.location * WEIGHTS.location +
    breakdown.comp * WEIGHTS.comp +
    breakdown.recency * WEIGHTS.recency;

  return {
    overallScore: Math.round(overall * 100),
    scoreBreakdown: breakdown,
    explanation: [sk.line, ti.line, ind.line, loc.line, comp.line, rec.line],
    matchedSkills: sk.matched,
    missingSkills: sk.missing,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
