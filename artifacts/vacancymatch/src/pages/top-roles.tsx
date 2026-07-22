import React, { useState } from "react";
import { Link } from "wouter";
import {
  useGetRoleAnalysis,
  useRefreshRoleAnalysis,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Building2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const SECTOR_COLORS: Record<string, { dot: string; badge: string }> = {
  insurance: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  banking: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
  pensions: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800" },
  asset_management: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  accountancy_finance: { dot: "bg-teal-500", badge: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800" },
  it_tech: { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800" },
};

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
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-medium text-sm">{title}</span>
        <div className="flex items-center gap-3 shrink-0">
          <button
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-label={`${count} companies hiring — click to ${open ? "collapse" : "expand"}`}
          >
            <Building2 className="w-3.5 h-3.5" />
            {count} {count === 1 ? "company" : "companies"}
          </button>
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 bg-muted/20 border-t flex flex-wrap gap-2">
          {companies.length === 0 ? (
            <span className="text-xs text-muted-foreground">No company data.</span>
          ) : (
            companies.map((c) => (
              <Link
                key={c.name}
                href={`/job-search?q=${encodeURIComponent(c.name)}`}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-background hover:bg-muted hover:border-primary/40 transition-colors text-foreground"
              >
                <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                {c.name}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SectorBlock({
  sector,
  label,
  roles,
}: {
  sector: string;
  label: string;
  roles: Array<{ title: string; count: number; companies: Array<{ name: string }> }>;
}) {
  const colors = SECTOR_COLORS[sector] ?? {
    dot: "bg-gray-400",
    badge: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", colors.dot)} />
        <h2 className="font-semibold text-base">{label}</h2>
        <Badge
          variant="outline"
          className={cn("text-xs font-normal ml-1", colors.badge)}
        >
          {roles.length} role{roles.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="space-y-2">
        {roles.map((r, i) => (
          <div key={r.title} className="flex gap-3 items-start">
            <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 pt-3 text-right">
              {i + 1}
            </span>
            <div className="flex-1">
              <RoleRow title={r.title} count={r.count} companies={r.companies} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TopRoles() {
  const initialSector = new URLSearchParams(window.location.search).get("sector") ?? "all";
  const [selectedSector, setSelectedSector] = useState(initialSector);
  const { data, isLoading, refetch } = useGetRoleAnalysis();
  const { mutate: refresh, isPending: isRefreshing } = useRefreshRoleAnalysis({
    mutation: {
      onSuccess: () => {
        void refetch();
      },
    },
  });

  const sectors = data?.sectors ?? [];
  const filteredSectors =
    selectedSector === "all"
      ? sectors
      : sectors.filter((s) => s.sector === selectedSector);

  const lastUpdated = data?.lastUpdatedAt
    ? new Date(data.lastUpdatedAt)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Top Roles by Industry
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-analysed top hiring roles across active live job postings, grouped by industry.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isRefreshing || isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Analysing…" : "Refresh analysis"}
          </Button>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </div>
          )}
        </div>
      </div>

      {/* Industry filter */}
      {!isLoading && sectors.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0">Filter by industry:</span>
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-9 w-56 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All industries</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.sector} value={s.sector}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {isLoading || isRefreshing ? (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-40" />
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          ))}
        </div>
      ) : data?.status === "empty" || sectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-card border rounded-xl border-dashed">
          <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">No job data to analyse yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
            Connect job sources and ingest some vacancies. Once jobs with industry tags are available, the AI will analyse the top hiring roles.
          </p>
        </div>
      ) : filteredSectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
          <h3 className="text-lg font-medium">No roles for this industry</h3>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setSelectedSector("all")}
          >
            Show all industries
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2">
          {filteredSectors.map((s) => (
            <Card key={s.sector} className="p-6">
              <SectorBlock
                sector={s.sector}
                label={s.label}
                roles={s.roles}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
