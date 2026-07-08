import type {
  AlertRule,
  AuditLog,
  Candidate,
  CrmSyncEvent,
  Job,
  Match,
  MatchRun,
  JobSource,
} from "@workspace/db";
import {
  classifyJobForDisplay,
  classifyCandidateForDisplay,
} from "./search/classification";

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

export interface SearchDebugDto {
  score: number;
  sector: string | null;
  function: string | null;
  employerType: string | null;
  sectorBoost: number;
  functionBoost: number;
  employerTypeBoost: number;
  directEmployerBoost: number;
  matchedTerms: string[];
}

export function toCandidateDto(c: Candidate, searchDebug?: SearchDebugDto) {
  return {
    ...(searchDebug ? { searchDebug } : {}),
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    currentTitle: c.currentTitle,
    currentCompany: c.currentCompany,
    locationText: c.locationText,
    summary: c.summary,
    seniority: c.seniority,
    skills: c.skills,
    titles: c.titles,
    industries: c.industries,
    remotePreference: c.remotePreference,
    desiredSalaryMin: c.desiredSalaryMin,
    desiredSalaryMax: c.desiredSalaryMax,
    salaryCurrency: c.salaryCurrency,
    cvFileName: c.cvFileName,
    cvFileKey: c.cvFileKey,
    cvText: c.cvText,
    status: c.status,
    lastMatchedAt: iso(c.lastMatchedAt),
    bestMatchScore: c.bestMatchScore,
    matchCount: c.matchCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toJobDto(
  j: Job,
  sourceName?: string | null,
  searchDebug?: SearchDebugDto,
) {
  return {
    ...(searchDebug ? { searchDebug } : {}),
    id: j.id,
    sourceId: j.sourceId,
    sourceName: sourceName ?? null,
    title: j.title,
    companyName: j.companyName,
    locationText: j.locationText,
    remoteType: j.remoteType,
    employmentType: j.employmentType,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    salaryCurrency: j.salaryCurrency,
    descriptionText: j.descriptionText,
    applyUrl: j.applyUrl,
    industry: j.industry,
    skills: j.skills,
    postedAt: iso(j.postedAt),
    expiresAt: iso(j.expiresAt),
    status: j.status,
    salaryText: j.salaryText,
    sourceType: j.sourceType,
    sourceProvider: j.sourceProvider,
    sourceUrl: j.sourceUrl,
    isCanonical: j.isCanonical,
    classification: classifyJobForDisplay({
      title: j.title,
      descriptionText: j.descriptionText,
      companyName: j.companyName,
      industry: j.industry,
      skills: j.skills,
    }),
    createdAt: j.createdAt.toISOString(),
  };
}

/** Candidate fields needed to infer a display classification on match cards. */
export interface MatchCandidateLike {
  currentTitle: string | null;
  currentCompany: string | null;
  titles: string[] | null;
  skills: string[] | null;
  industries: string[] | null;
}

export function toMatchDto(
  m: Match,
  job: Job,
  sourceName?: string | null,
  candidateName?: string | null,
  candidate?: MatchCandidateLike | null,
) {
  return {
    id: m.id,
    matchRunId: m.matchRunId,
    candidateId: m.candidateId,
    candidateName: candidateName ?? null,
    candidateClassification: candidate
      ? classifyCandidateForDisplay(candidate)
      : null,
    jobId: m.jobId,
    job: toJobDto(job, sourceName),
    overallScore: m.overallScore,
    scoreBreakdown: m.scoreBreakdown,
    explanation: m.explanation,
    matchedSkills: m.matchedSkills,
    missingSkills: m.missingSkills,
    recruiterStatus: m.recruiterStatus,
    recruiterNote: m.recruiterNote,
    pushedToCrm: m.pushedToCrm,
    createdAt: m.createdAt.toISOString(),
  };
}

export function toMatchRunDto(r: MatchRun) {
  return {
    id: r.id,
    candidateId: r.candidateId,
    triggerType: r.triggerType,
    modelVersion: r.modelVersion,
    status: r.status,
    matchCount: r.matchCount,
    startedAt: r.startedAt.toISOString(),
    completedAt: iso(r.completedAt),
  };
}

export interface JobSourceMetrics {
  totalJobs: number;
  activeJobs: number;
  canonicalJobs: number;
  duplicateJobs: number;
}

export const EMPTY_JOB_SOURCE_METRICS: JobSourceMetrics = {
  totalJobs: 0,
  activeJobs: 0,
  canonicalJobs: 0,
  duplicateJobs: 0,
};

export function toJobSourceDto(s: JobSource, metrics: JobSourceMetrics) {
  return {
    id: s.id,
    name: s.name,
    sourceType: s.sourceType,
    baseUrl: s.baseUrl,
    isActive: s.isActive,
    healthStatus: s.healthStatus,
    lastSyncAt: iso(s.lastSyncAt),
    // jobCount kept for backwards compatibility: currently-active jobs
    jobCount: metrics.activeJobs,
    isDemo: s.isDemo,
    provider: s.provider,
    totalJobs: metrics.totalJobs,
    activeJobs: metrics.activeJobs,
    canonicalJobs: metrics.canonicalJobs,
    duplicateJobs: metrics.duplicateJobs,
    lastFetchCount: s.lastFetchCount,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toAlertRuleDto(a: AlertRule, candidateName?: string | null) {
  return {
    id: a.id,
    candidateId: a.candidateId,
    candidateName: candidateName ?? null,
    minScore: a.minScore,
    frequency: a.frequency,
    isActive: a.isActive,
    lastCheckedAt: iso(a.lastCheckedAt),
    lastTriggeredAt: iso(a.lastTriggeredAt),
    createdAt: a.createdAt.toISOString(),
  };
}

export function toCrmSyncEventDto(
  e: CrmSyncEvent,
  candidateName?: string | null,
  jobTitle?: string | null,
) {
  return {
    id: e.id,
    candidateId: e.candidateId,
    candidateName: candidateName ?? null,
    jobId: e.jobId,
    jobTitle: jobTitle ?? null,
    direction: e.direction,
    crmName: e.crmName,
    payloadSummary: e.payloadSummary,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    processedAt: iso(e.processedAt),
  };
}

export function toAuditLogDto(l: AuditLog) {
  return {
    id: l.id,
    actorName: l.actorName,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    metadata: l.metadata,
    createdAt: l.createdAt.toISOString(),
  };
}
