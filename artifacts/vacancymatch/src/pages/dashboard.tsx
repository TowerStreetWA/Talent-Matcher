import React, { useState } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetIndustryCounts,
  useGetRoleAnalysis,
  useRefreshRoleAnalysis,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, Briefcase, Database, Building2, RefreshCw, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import GettingStarted from "@/components/getting-started";

function ZeroCta({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-xs text-primary hover:underline font-medium">
      {label} →
    </Link>
  );
}

const SECTOR_COLORS: Record<string, { dot: string; bar: string; card: string; count: string }> = {
  insurance: {
    dot: "bg-blue-500",
    bar: "bg-blue-500/20",
    card: "bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900",
    count: "text-blue-700 dark:text-blue-300",
  },
  banking: {
    dot: "bg-emerald-500",
    bar: "bg-emerald-500/20",
    card: "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900",
    count: "text-emerald-700 dark:text-emerald-300",
  },
  pensions: {
    dot: "bg-violet-500",
    bar: "bg-violet-500/20",
    card: "bg-violet-50 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900",
    count: "text-violet-700 dark:text-violet-300",
  },
  asset_management: {
    dot: "bg-amber-500",
    bar: "bg-amber-500/20",
    card: "bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900",
    count: "text-amber-700 dark:text-amber-300",
  },
  accountancy_finance: {
    dot: "bg-teal-500",
    bar: "bg-teal-500/20",
    card: "bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900",
    count: "text-teal-700 dark:text-teal-300",
  },
  it_tech: {
    dot: "bg-orange-500",
    bar: "bg-orange-500/20",
    card: "bg-orange-50 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900",
    count: "text-orange-700 dark:text-orange-300",
  },
};

const DEFAULT_COLOR = {
  dot: "bg-gray-400",
  bar: "bg-gray-200",
  card: "bg-gray-50 border-gray-100 dark:bg-gray-900 dark:border-gray-800",
  count: "text-gray-700 dark:text-gray-300",
};

function IndustryCountsSection() {
  const { data: counts, isLoading } = useGetIndustryCounts();
  const maxCount = Math.max(...(counts?.map((c) => c.count) ?? [1]), 1);

  if (isLoading) {
    return (
      <div>
        <h2 className="font-semibold text-base mb-3">Jobs by Industry</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!counts || counts.length === 0) {
    return (
      <div>
        <h2 className="font-semibold text-base mb-3">Jobs by Industry</h2>
        <p className="text-sm text-muted-foreground">
          No sector-tagged jobs yet.{" "}
          <Link href="/sources" className="text-primary hover:underline">
            Connect a job source →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base">Jobs by Industry</h2>
        <Link
          href="/top-roles"
          className="text-xs text-primary hover:underline font-medium"
        >
          View top roles →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((c) => {
          const colors = SECTOR_COLORS[c.sector] ?? DEFAULT_COLOR;
          const pct = Math.max(8, Math.round((c.count / maxCount) * 100));
          return (
            <Link key={c.sector} href={`/top-roles?sector=${c.sector}`}>
              <div
                className={cn(
                  "rounded-lg border p-3 flex flex-col gap-2 cursor-pointer hover:shadow-sm transition-shadow",
                  colors.card,
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
                    <span className="text-sm font-medium">{c.label}</span>
                  </div>
                  <span className={cn("text-lg font-bold tabular-nums", colors.count)}>
                    {c.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", colors.dot)}
                    style={{ width: `${pct}%`, opacity: 0.7 }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RoleRow({
  title,
  count,
  companies,
}: {
  title: string;
  count: number;
  companies: Array<{ name: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="w-full flex items-center justify-between py-2 text-left group"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-primary">
            {count} {count === 1 ? "co." : "cos."}
          </span>
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>
      {open && (
        <div className="pb-2 flex flex-wrap gap-1.5">
          {companies.map((c) => (
            <Link
              key={c.name}
              href={`/job-search?q=${encodeURIComponent(c.name)}`}
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border bg-background hover:bg-muted hover:border-primary/40 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Building2 className="w-2.5 h-2.5 text-muted-foreground" />
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TopRolesSection() {
  const { data, isLoading, refetch } = useGetRoleAnalysis();
  const { mutate: refresh, isPending: isRefreshing } = useRefreshRoleAnalysis({
    mutation: { onSuccess: () => void refetch() },
  });

  const lastUpdated = data?.lastUpdatedAt ? new Date(data.lastUpdatedAt) : null;
  const sectors = data?.sectors ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Top Roles by Industry</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI-analysed hiring patterns across live job postings.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs px-2"
              onClick={() => refresh()}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Analysing…" : "Refresh"}
            </Button>
            {lastUpdated && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || isRefreshing ? (
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-36" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : sectors.length === 0 ? (
          <div className="py-8 flex flex-col items-center text-center gap-2">
            <Briefcase className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No jobs to analyse yet.{" "}
              <Link href="/sources" className="text-primary hover:underline">
                Connect a source →
              </Link>
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {sectors.map((s) => {
              const colors = SECTOR_COLORS[s.sector] ?? DEFAULT_COLOR;
              return (
                <div key={s.sector} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
                    <h3 className="text-sm font-semibold">{s.label}</h3>
                    <Badge variant="secondary" className="text-xs h-4 px-1.5 font-normal ml-auto">
                      top {s.roles.length}
                    </Badge>
                  </div>
                  <div className="divide-y divide-border/50">
                    {s.roles.slice(0, 5).map((r, i) => (
                      <div key={r.title} className="flex gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-4 shrink-0 pt-2 text-right">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <RoleRow
                            title={r.title}
                            count={r.count}
                            companies={r.companies}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {s.roles.length > 5 && (
                    <Link
                      href={`/top-roles?sector=${s.sector}`}
                      className="text-xs text-muted-foreground hover:text-primary mt-1 inline-block"
                    >
                      +{s.roles.length - 5} more roles →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {sectors.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Link
              href="/top-roles"
              className="text-xs text-primary hover:underline font-medium"
            >
              View full analysis →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Market and pipeline overview.</p>
      </div>

      <GettingStarted />

      {/* Stat boxes */}
      {loadingSummary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Candidates
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.candidateCount}</div>
              {summary.candidateCount === 0 && (
                <ZeroCta href="/upload" label="Upload your first CV" />
              )}
            </CardContent>
          </Card>
          <Card className="border-highlight">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Live Jobs
              </CardTitle>
              <Briefcase className="h-4 w-4 text-highlight" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-highlight">
                {summary.activeJobCount}
              </div>
              {summary.activeJobCount === 0 && (
                <ZeroCta href="/sources" label="Connect a job source" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Shortlisted
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.shortlistedCount}</div>
              {summary.shortlistedCount === 0 && (
                <ZeroCta href="/matches" label="Review matches" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Sources
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeSourceCount}</div>
              {summary.activeSourceCount === 0 && (
                <ZeroCta href="/sources" label="Add a source" />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Jobs by Industry */}
      <IndustryCountsSection />

      {/* Top Roles by Industry */}
      <TopRolesSection />
    </div>
  );
}
