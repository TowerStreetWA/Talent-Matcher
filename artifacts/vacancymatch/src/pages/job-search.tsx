import React, { useEffect, useState } from "react";
import { useSearchJobs, type SearchJobsSector } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Briefcase,
  MapPin,
  Building,
  ExternalLink,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";
import { track } from "@/lib/analytics";

const SECTORS: { value: SearchJobsSector; label: string }[] = [
  { value: "insurance", label: "Insurance" },
  { value: "banking", label: "Banking" },
  { value: "pensions", label: "Pensions" },
  { value: "asset_management", label: "Asset Management" },
];

const sectorLabel = (value: string | null | undefined): string | null =>
  SECTORS.find((s) => s.value === value)?.label ?? null;

const PAGE_SIZE = 25;

const isSector = (value: string): value is SearchJobsSector =>
  SECTORS.some((s) => s.value === value);

const initialParams = (): { q: string; location: string; sector: SearchJobsSector | "all" } => {
  const params = new URLSearchParams(window.location.search);
  const sectorParam = params.get("sector") ?? "";
  return {
    q: params.get("q") ?? "",
    location: params.get("location") ?? "",
    sector: isSector(sectorParam) ? sectorParam : "all",
  };
};

export default function JobSearch() {
  const [initial] = useState(initialParams);
  const [q, setQ] = useState(initial.q);
  const [location, setLocation] = useState(initial.location);
  const [sector, setSector] = useState<SearchJobsSector | "all">(initial.sector);
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounce(q, 300);
  const debouncedLocation = useDebounce(location, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, debouncedLocation, sector]);

  const { data, isLoading } = useSearchJobs({
    ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
    ...(debouncedLocation.trim() ? { location: debouncedLocation.trim() } : {}),
    ...(sector !== "all" ? { sector } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const results = data?.results;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (isLoading || !data) return;
    const hasQuery =
      Boolean(debouncedQ.trim()) ||
      Boolean(debouncedLocation.trim()) ||
      sector !== "all";
    if (!hasQuery) return;
    track("job_search_performed", {
      query: debouncedQ.trim(),
      location: debouncedLocation.trim(),
      ...(sector !== "all" ? { sector } : {}),
      page,
      resultCount: data.total,
    });
    if (data.total === 0) {
      track("job_search_zero_results", {
        query: debouncedQ.trim(),
        location: debouncedLocation.trim(),
        ...(sector !== "all" ? { sector } : {}),
      });
    }
  }, [data, isLoading, debouncedQ, debouncedLocation, sector, page]);

  const hasActiveFilters =
    Boolean(debouncedQ.trim()) ||
    Boolean(debouncedLocation.trim()) ||
    sector !== "all";
  const clearAll = (): void => {
    setQ("");
    setLocation("");
    setSector("all");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Search</h1>
        <p className="text-muted-foreground mt-1">
          Search live vacancies by title, location, and sector — ranked by relevance.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Job title or keywords — try "underwriter", "claims handler", "kyc"...'
            className="pl-9 h-11 bg-card shadow-sm"
            data-testid="input-job-search-q"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="pl-9 h-11 w-full sm:w-44 bg-card"
              data-testid="input-job-search-location"
            />
          </div>
          <Select
            value={sector}
            onValueChange={(v) => setSector(v as SearchJobsSector | "all")}
          >
            <SelectTrigger className="h-11 w-full sm:w-48 bg-card" data-testid="select-job-search-sector">
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {SECTORS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTORS.map((s) => (
          <Button
            key={s.value}
            variant={sector === s.value ? "default" : "outline"}
            size="sm"
            className="h-7 rounded-full text-xs"
            onClick={() => setSector(sector === s.value ? "all" : s.value)}
            data-testid={`chip-sector-${s.value}`}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm min-h-6">
        {debouncedQ.trim() && (
          <Badge variant="secondary" className="gap-1 font-normal">
            Search: “{debouncedQ.trim()}”
            <button aria-label="Clear search" onClick={() => setQ("")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {debouncedLocation.trim() && (
          <Badge variant="secondary" className="gap-1 font-normal">
            Location: {debouncedLocation.trim()}
            <button aria-label="Clear location filter" onClick={() => setLocation("")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {sector !== "all" && (
          <Badge variant="secondary" className="gap-1 font-normal">
            Sector: {sectorLabel(sector)}
            <button aria-label="Clear sector filter" onClick={() => setSector("all")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
            Clear all
          </Button>
        )}
        {!isLoading && data && (
          <span className="text-muted-foreground ml-auto" data-testid="text-job-search-count">
            {total} job{total === 1 ? "" : "s"} found
          </span>
        )}
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : results?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
            <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No jobs found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md text-center">
              No jobs found for this combination. Try broadening the title,
              removing some filters, or switching sector.
            </p>
            {hasActiveFilters && (
              <div className="flex gap-2 mt-4">
                {debouncedLocation.trim() && (
                  <Button variant="outline" size="sm" onClick={() => setLocation("")}>
                    Remove location
                  </Button>
                )}
                {sector !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setSector("all")}>
                    All sectors
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={clearAll}>
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          results?.map((job) => (
            <Card
              key={job.id}
              className="overflow-hidden hover:border-primary/40 transition-colors"
              data-testid={`card-job-search-${job.id}`}
              onClick={() => {
                if (debouncedQ.trim()) {
                  track("job_search_result_clicked", {
                    query: debouncedQ.trim(),
                    resultId: job.id,
                  });
                }
              }}
            >
              <CardContent className="p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {job.sourceType === "direct_employer" && (
                        <Badge variant="outline" className="text-xs font-normal border-primary/40 text-primary">
                          Direct employer
                        </Badge>
                      )}
                      {job.sourceType === "google_jobs" && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Google Jobs
                        </Badge>
                      )}
                      {job.sourceType === "agency" && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Agency
                        </Badge>
                      )}
                      {!job.sourceType && job.sourceName && (
                        <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
                          {job.sourceName}
                        </Badge>
                      )}
                      {sectorLabel(job.sector) && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {sectorLabel(job.sector)}
                        </Badge>
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
                        {job.locationText || "Remote"}
                      </div>
                      {job.salaryText && (
                        <span className="font-mono text-xs">{job.salaryText}</span>
                      )}
                    </div>
                  </div>

                  {job.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{job.summary}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {job.explanation.titleMatch && (
                      <Badge variant="secondary" className="font-normal text-xs px-2 rounded-sm">
                        Title match
                      </Badge>
                    )}
                    {job.explanation.sectorMatch && (
                      <Badge variant="secondary" className="font-normal text-xs px-2 rounded-sm">
                        Sector match
                      </Badge>
                    )}
                    {job.explanation.locationMatch && (
                      <Badge variant="secondary" className="font-normal text-xs px-2 rounded-sm">
                        Location match
                      </Badge>
                    )}
                    {job.explanation.recentPosting && (
                      <Badge variant="secondary" className="font-normal text-xs px-2 rounded-sm">
                        Recently posted
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex md:flex-col items-center justify-between md:justify-start gap-4 md:border-l md:pl-6">
                  {job.applyUrl && (
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                        View details <ExternalLink className="ml-2 w-3 h-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {!isLoading && total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="button-job-search-prev"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            data-testid="button-job-search-next"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
