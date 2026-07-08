import React, { useEffect, useState } from "react";
import { useListJobs, useListJobSources } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Briefcase, MapPin, Building, ExternalLink, Clock, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { SearchBox } from "@/components/search-box";
import { ResearchUrlDialog } from "@/components/research-url-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { track } from "@/lib/analytics";
import { ClassificationTags } from "@/components/classification-tags";

export default function Jobs() {
  const [search, setSearch] = useState("");
  const [sourceId, setSourceId] = useState("all");
  const [status, setStatus] = useState("all");
  const debouncedSearch = useDebounce(search, 300);

  const { data: sources } = useListJobSources();
  const { data: jobs, isLoading } = useListJobs({
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    ...(sourceId !== "all" ? { sourceId } : {}),
    ...(status !== "all" ? { status } : {}),
  });

  useEffect(() => {
    if (!debouncedSearch.trim() || isLoading || !jobs) return;
    track("search_performed", {
      scope: "jobs",
      query: debouncedSearch.trim(),
      resultCount: jobs.length,
      sourceFilter: sourceId,
      statusFilter: status,
    });
    if (jobs.length === 0) {
      track("search_zero_results", {
        scope: "jobs",
        query: debouncedSearch.trim(),
        sourceFilter: sourceId,
        statusFilter: status,
      });
    }
  }, [debouncedSearch, jobs, isLoading, sourceId, status]);

  const sourceName = sources?.find((s) => s.id === sourceId)?.name;
  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) || sourceId !== "all" || status !== "all";
  const clearAll = (): void => {
    setSearch("");
    setSourceId("all");
    setStatus("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Jobs Market</h1>
          <p className="text-muted-foreground mt-1">Search active vacancies across connected sources.</p>
        </div>
        <ResearchUrlDialog />
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <SearchBox
            scope="jobs"
            value={search}
            onChange={setSearch}
            placeholder='Try "swe", "front-end dev", a company, or a skill...'
            inputClassName="pl-9 h-11 bg-card shadow-sm"
          />
        </div>
        <div className="flex gap-3">
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="h-11 w-full sm:w-44 bg-card">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 w-full sm:w-36 bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm min-h-6">
        {debouncedSearch.trim() && (
          <Badge variant="secondary" className="gap-1 font-normal">
            Search: “{debouncedSearch.trim()}”
            <button aria-label="Clear search" onClick={() => setSearch("")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {sourceId !== "all" && (
          <Badge variant="secondary" className="gap-1 font-normal">
            Source: {sourceName ?? "…"}
            <button aria-label="Clear source filter" onClick={() => setSourceId("all")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {status !== "all" && (
          <Badge variant="secondary" className="gap-1 font-normal capitalize">
            Status: {status}
            <button aria-label="Clear status filter" onClick={() => setStatus("all")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
            Clear all
          </Button>
        )}
        {!isLoading && jobs && (
          <span className="text-muted-foreground ml-auto">
            {jobs.length} job{jobs.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : jobs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
            <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No jobs found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md text-center">
              {debouncedSearch.trim()
                ? `Nothing matched “${debouncedSearch.trim()}”${sourceId !== "all" || status !== "all" ? " with the current filters" : ""}. Try a broader term — shorthand like “swe” or “fe dev” works too.`
                : hasActiveFilters
                  ? "The current filters exclude every job."
                  : "No live jobs yet — connect a job source to start ingesting vacancies."}
            </p>
            {hasActiveFilters && (
              <div className="flex gap-2 mt-4">
                {debouncedSearch.trim() && (
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                )}
                {sourceId !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setSourceId("all")}>
                    All sources
                  </Button>
                )}
                {status !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setStatus("all")}>
                    All statuses
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={clearAll}>
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          jobs?.map((job) => (
            <Card
              key={job.id}
              className="overflow-hidden hover:border-primary/40 transition-colors"
              onClick={() => {
                if (debouncedSearch.trim()) {
                  track("search_result_clicked", {
                    scope: "jobs",
                    query: debouncedSearch.trim(),
                    resultId: job.id,
                  });
                }
              }}
            >
              <CardContent className="p-0">
                <div className="p-6 flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
                          {job.sourceName || "Direct"}
                        </Badge>
                        {job.sourceType === "direct_employer" && (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal border-primary/40 text-primary"
                            data-testid={`badge-direct-employer-${job.id}`}
                          >
                            Direct employer
                          </Badge>
                        )}
                        {job.sourceType === "google_jobs" && (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                            data-testid={`badge-google-jobs-${job.id}`}
                          >
                            Google Jobs
                          </Badge>
                        )}
                        {job.isCanonical === false && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-normal text-muted-foreground"
                            data-testid={`badge-duplicate-${job.id}`}
                          >
                            Duplicate
                          </Badge>
                        )}
                        {job.classification && (
                          <ClassificationTags
                            sectorLabel={job.classification.sectorLabel}
                            familyLabels={job.classification.familyLabels}
                            familyKeys={job.classification.families}
                          />
                        )}
                        {job.postedAt && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold leading-tight mb-1">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          {job.companyName || "Unknown Company"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {job.locationText || "Remote"} {job.remoteType ? `(${job.remoteType})` : ""}
                        </div>
                        {job.salaryMin && job.salaryMax && (
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            {job.salaryCurrency}{job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {job.skills.slice(0, 8).map((skill, i) => (
                        <Badge key={i} variant="secondary" className="font-normal text-xs px-2 rounded-sm bg-accent/50 text-accent-foreground border-accent-border/50">
                          {skill}
                        </Badge>
                      ))}
                      {job.skills.length > 8 && (
                        <Badge variant="outline" className="font-normal text-xs px-2 rounded-sm">
                          +{job.skills.length - 8}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center justify-between md:justify-start gap-4 md:border-l md:pl-6">
                    <Badge variant={job.status === "active" ? "default" : "secondary"}>
                      {job.status}
                    </Badge>
                    {job.applyUrl && (
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                          Apply <ExternalLink className="ml-2 w-3 h-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
