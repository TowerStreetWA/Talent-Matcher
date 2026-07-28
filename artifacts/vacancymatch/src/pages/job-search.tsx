import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSearchJobs,
  useListJobSearchFamilies,
  getListJobSearchFamiliesQueryKey,
  useListSavedJobSearches,
  useCreateSavedJobSearch,
  useUpdateSavedJobSearch,
  useDeleteSavedJobSearch,
  getListSavedJobSearchesQueryKey,
  type SearchJobsSector,
  type SearchJobsSource,
  type SavedJobSearch as SavedJobSearchDto,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Bookmark,
  Bell,
  BellOff,
  Trash2,
  Play,
  ClipboardList,
} from "lucide-react";
import { SendToSpecListDialog } from "@/components/send-to-spec-list-dialog";
import { formatDistanceToNow } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { setSkylineCity } from "@/components/skyline-backdrop";
import { ClassificationTags } from "@/components/classification-tags";
import { CompanyMonogram } from "@/components/company-monogram";
import { useDebounce } from "@/hooks/use-debounce";
import { track } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";

const SECTORS: { value: SearchJobsSector; label: string }[] = [
  { value: "insurance", label: "Insurance" },
  { value: "banking", label: "Banking" },
  { value: "pensions", label: "Pensions" },
  { value: "asset_management", label: "Asset Management" },
  { value: "accountancy_finance", label: "Accountancy & Finance" },
  { value: "it_tech", label: "IT & Tech" },
];

const SOURCES: { value: SearchJobsSource; label: string }[] = [
  { value: "direct_employer", label: "Direct employer" },
  { value: "google_jobs", label: "Google Jobs" },
  { value: "job_board", label: "Job board" },
  { value: "agency", label: "Agency" },
];

const sectorLabel = (value: string | null | undefined): string | null =>
  SECTORS.find((s) => s.value === value)?.label ?? null;

const sourceLabel = (value: string | null | undefined): string | null =>
  SOURCES.find((s) => s.value === value)?.label ?? null;

const PAGE_SIZE = 25;

const isSector = (value: string): value is SearchJobsSector =>
  SECTORS.some((s) => s.value === value);

const isSource = (value: string): value is SearchJobsSource =>
  SOURCES.some((s) => s.value === value);

interface FilterState {
  q: string;
  location: string;
  sector: SearchJobsSector | "all";
  source: SearchJobsSource | "all";
  families: string[];
  includeRecruiters: boolean;
}

const initialParams = (): FilterState => {
  const params = new URLSearchParams(window.location.search);
  const sectorParam = params.get("sector") ?? "";
  const sourceParam = params.get("source") ?? "";
  const familiesParam = params.get("families") ?? "";
  const includeRecruitersParam = params.get("includeRecruiters") ?? "";
  return {
    q: params.get("q") ?? "",
    location: params.get("location") ?? "",
    sector: isSector(sectorParam) ? sectorParam : "all",
    source: isSource(sourceParam) ? sourceParam : "all",
    families: familiesParam
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean),
    includeRecruiters:
      includeRecruitersParam === "true" || includeRecruitersParam === "1",
  };
};

const savedSearchSummary = (s: SavedJobSearchDto): string => {
  const parts: string[] = [];
  if (s.query) parts.push(`“${s.query}”`);
  if (s.location) parts.push(s.location);
  const sec = sectorLabel(s.sector);
  if (sec) parts.push(sec);
  if (s.families.length > 0)
    parts.push(
      s.families.length === 1
        ? "1 family"
        : `${s.families.length} families`,
    );
  const src = sourceLabel(s.sourceType);
  if (src) parts.push(src);
  if (s.includeRecruiters) parts.push("incl. recruiters");
  return parts.length > 0 ? parts.join(" · ") : "All jobs";
};

export default function JobSearch() {
  const [initial] = useState(initialParams);
  const [q, setQ] = useState(initial.q);
  const [location, setLocation] = useState(initial.location);
  const [sector, setSector] = useState<SearchJobsSector | "all">(initial.sector);
  const [source, setSource] = useState<SearchJobsSource | "all">(initial.source);
  const [families, setFamilies] = useState<string[]>(initial.families);
  const [includeRecruiters, setIncludeRecruiters] = useState(
    initial.includeRecruiters,
  );
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounce(q, 300);
  const debouncedLocation = useDebounce(location, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, debouncedLocation, sector, source, families, includeRecruiters]);

  // Dark-mode skyline backdrop: show Paris when searching French locations.
  useEffect(() => {
    const loc = location.toLowerCase();
    setSkylineCity(
      loc.includes("paris") || loc.includes("france") ? "paris" : "london",
    );
    return () => setSkylineCity("london");
  }, [location]);

  const familyParams = sector !== "all" ? { sector } : undefined;
  const { data: familyCatalog } = useListJobSearchFamilies(familyParams, {
    query: {
      enabled: sector !== "all",
      queryKey: getListJobSearchFamiliesQueryKey(familyParams),
    },
  });
  const sectorFamilies =
    sector !== "all"
      ? (familyCatalog?.sectors.find((s) => s.sector === sector)?.families ?? [])
      : [];
  const familyLabel = (key: string): string =>
    sectorFamilies.find((f) => f.key === key)?.label ?? key;

  const changeSector = (next: SearchJobsSector | "all"): void => {
    setSector(next);
    // Family keys are sector-scoped; clear them whenever the sector changes.
    setFamilies([]);
  };
  const toggleFamily = (key: string): void => {
    setFamilies((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
    );
  };
  // Clicking a family tag on a result card applies that family as a filter,
  // scoping to the card's sector first when no sector filter is active.
  const applyFamilyFromCard = (jobSector: string | null | undefined, key: string): void => {
    if (sector === "all") {
      if (jobSector && isSector(jobSector)) {
        setSector(jobSector);
        setFamilies([key]);
      } else {
        setFamilies((prev) => (prev.includes(key) ? prev : [...prev, key]));
      }
      return;
    }
    setFamilies((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const { data, isLoading } = useSearchJobs({
    ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
    ...(debouncedLocation.trim() ? { location: debouncedLocation.trim() } : {}),
    ...(sector !== "all" ? { sector } : {}),
    ...(families.length > 0 ? { families: families.join(",") } : {}),
    ...(source !== "all" ? { source } : {}),
    ...(includeRecruiters ? { includeRecruiters: true } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const results = data?.results;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: savedSearches } = useListSavedJobSearches();
  const createSaved = useCreateSavedJobSearch();
  const updateSaved = useUpdateSavedJobSearch();
  const deleteSaved = useDeleteSavedJobSearch();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAlerts, setSaveAlerts] = useState(false);
  const [specListTarget, setSpecListTarget] = useState<{
    id: string;
    title: string;
    companyName?: string | null;
  } | null>(null);

  const invalidateSaved = (): void => {
    void queryClient.invalidateQueries({
      queryKey: getListSavedJobSearchesQueryKey(),
    });
  };

  const defaultSaveName = (): string => {
    const parts: string[] = [];
    if (debouncedQ.trim()) parts.push(debouncedQ.trim());
    if (debouncedLocation.trim()) parts.push(debouncedLocation.trim());
    if (sector !== "all") parts.push(sectorLabel(sector) ?? sector);
    return parts.join(" · ") || "All jobs";
  };

  const openSaveDialog = (): void => {
    setSaveName(defaultSaveName());
    setSaveAlerts(false);
    setSaveOpen(true);
  };

  const handleSave = (): void => {
    const name = saveName.trim() || defaultSaveName();
    createSaved.mutate(
      {
        data: {
          name,
          query: debouncedQ.trim(),
          location: debouncedLocation.trim(),
          sector: sector !== "all" ? sector : null,
          families,
          sourceType: source !== "all" ? source : null,
          includeRecruiters,
          alertEnabled: saveAlerts,
        },
      },
      {
        onSuccess: () => {
          setSaveOpen(false);
          invalidateSaved();
          toast({ title: "Search saved", description: `“${name}” added to your saved searches.` });
          track("job_search_saved", {
            query: debouncedQ.trim(),
            ...(sector !== "all" ? { sector } : {}),
            ...(families.length > 0 ? { families: families.join(",") } : {}),
            alertsEnabled: saveAlerts,
          });
        },
        onError: () => {
          toast({ title: "Could not save search", variant: "destructive" });
        },
      },
    );
  };

  const runSavedSearch = (s: SavedJobSearchDto): void => {
    setQ(s.query);
    setLocation(s.location);
    setSector(s.sector && isSector(s.sector) ? s.sector : "all");
    setFamilies(s.families ?? []);
    setSource(s.sourceType && isSource(s.sourceType) ? s.sourceType : "all");
    setIncludeRecruiters(s.includeRecruiters);
    setPage(1);
    track("job_search_saved_run", { savedSearchId: s.id });
  };

  const toggleAlerts = (s: SavedJobSearchDto): void => {
    updateSaved.mutate(
      { id: s.id, data: { alertEnabled: !s.alertEnabled } },
      {
        onSuccess: () => {
          invalidateSaved();
          toast({
            title: s.alertEnabled ? "Alerts off" : "Alerts on",
            description: `“${s.name}”`,
          });
        },
        onError: () => toast({ title: "Could not update alerts", variant: "destructive" }),
      },
    );
  };

  const removeSaved = (s: SavedJobSearchDto): void => {
    deleteSaved.mutate(
      { id: s.id },
      {
        onSuccess: () => {
          invalidateSaved();
          toast({ title: "Saved search deleted", description: `“${s.name}”` });
        },
        onError: () => toast({ title: "Could not delete saved search", variant: "destructive" }),
      },
    );
  };

  useEffect(() => {
    if (isLoading || !data) return;
    const hasQuery =
      Boolean(debouncedQ.trim()) ||
      Boolean(debouncedLocation.trim()) ||
      sector !== "all" ||
      families.length > 0 ||
      source !== "all";
    if (!hasQuery) return;
    track("job_search_performed", {
      query: debouncedQ.trim(),
      location: debouncedLocation.trim(),
      ...(sector !== "all" ? { sector } : {}),
      ...(families.length > 0 ? { families: families.join(",") } : {}),
      ...(source !== "all" ? { source } : {}),
      page,
      resultCount: data.total,
    });
    if (data.total === 0) {
      track("job_search_zero_results", {
        query: debouncedQ.trim(),
        location: debouncedLocation.trim(),
        ...(sector !== "all" ? { sector } : {}),
        ...(families.length > 0 ? { families: families.join(",") } : {}),
        ...(source !== "all" ? { source } : {}),
      });
    }
  }, [data, isLoading, debouncedQ, debouncedLocation, sector, families, source, page]);

  const hasActiveFilters =
    Boolean(debouncedQ.trim()) ||
    Boolean(debouncedLocation.trim()) ||
    sector !== "all" ||
    families.length > 0 ||
    source !== "all" ||
    includeRecruiters;
  const clearAll = (): void => {
    setQ("");
    setLocation("");
    setSector("all");
    setFamilies([]);
    setSource("all");
    setIncludeRecruiters(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Job Search</h1>
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
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
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
            onValueChange={(v) => changeSector(v as SearchJobsSector | "all")}
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
          <Select
            value={source}
            onValueChange={(v) => setSource(v as SearchJobsSource | "all")}
          >
            <SelectTrigger className="h-11 w-full sm:w-44 bg-card" data-testid="select-job-search-source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-11"
            onClick={openSaveDialog}
            data-testid="button-save-search"
          >
            <Bookmark className="w-4 h-4 mr-2" /> Save search
          </Button>
        </div>
      </div>

      {savedSearches && savedSearches.length > 0 && (
        <div className="bg-card border rounded-xl p-4 space-y-2" data-testid="panel-saved-searches">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bookmark className="w-4 h-4 text-muted-foreground" /> Saved searches
          </div>
          <div className="grid gap-1.5">
            {savedSearches.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-2 text-sm rounded-lg px-2 py-1.5 hover:bg-muted/50"
                data-testid={`row-saved-search-${s.id}`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground truncate max-w-md">
                  {savedSearchSummary(s)}
                </span>
                {s.alertEnabled && (
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <Bell className="w-3 h-3" /> Alerts on
                  </Badge>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => runSavedSearch(s)}
                    data-testid={`button-run-saved-${s.id}`}
                  >
                    <Play className="w-3 h-3 mr-1" /> Run
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => toggleAlerts(s)}
                    disabled={updateSaved.isPending}
                    data-testid={`button-toggle-alerts-${s.id}`}
                  >
                    {s.alertEnabled ? (
                      <>
                        <BellOff className="w-3 h-3 mr-1" /> Mute
                      </>
                    ) : (
                      <>
                        <Bell className="w-3 h-3 mr-1" /> Alerts
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => removeSaved(s)}
                    disabled={deleteSaved.isPending}
                    aria-label={`Delete saved search ${s.name}`}
                    data-testid={`button-delete-saved-${s.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {SECTORS.map((s) => (
          <Button
            key={s.value}
            variant={sector === s.value ? "default" : "outline"}
            size="sm"
            className={`h-7 rounded-full text-xs filter-chip ${sector === s.value ? "filter-chip-active" : ""}`}
            onClick={() => changeSector(sector === s.value ? "all" : s.value)}
            data-testid={`chip-sector-${s.value}`}
          >
            {s.label}
          </Button>
        ))}
        <label
          className="ml-auto flex items-center gap-2 text-xs text-muted-foreground cursor-pointer"
          data-testid="toggle-include-recruiters"
        >
          <Switch
            checked={includeRecruiters}
            onCheckedChange={setIncludeRecruiters}
            aria-label="Include recruitment agency posts"
          />
          Include recruitment agency posts
        </label>
      </div>

      {sector !== "all" && sectorFamilies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="row-family-chips">
          <span className="text-xs text-muted-foreground mr-1">
            {sectorLabel(sector)} families:
          </span>
          {sectorFamilies.map((f) => (
            <Button
              key={f.key}
              variant={families.includes(f.key) ? "default" : "outline"}
              size="sm"
              className={`h-7 rounded-full text-xs filter-chip ${families.includes(f.key) ? "filter-chip-active" : ""}`}
              onClick={() => toggleFamily(f.key)}
              data-testid={`chip-family-${f.key}`}
            >
              {f.label}
            </Button>
          ))}
          {families.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setFamilies([])}
              data-testid="button-clear-families"
            >
              Clear families
            </Button>
          )}
        </div>
      )}

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
            <button aria-label="Clear sector filter" onClick={() => changeSector("all")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {families.map((key) => (
          <Badge key={key} variant="secondary" className="gap-1 font-normal">
            Family: {familyLabel(key)}
            <button
              aria-label={`Clear family filter ${familyLabel(key)}`}
              onClick={() => toggleFamily(key)}
              className="ml-0.5 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {source !== "all" && (
          <Badge variant="secondary" className="gap-1 font-normal">
            Source: {sourceLabel(source)}
            <button aria-label="Clear source filter" onClick={() => setSource("all")} className="ml-0.5 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {includeRecruiters && (
          <Badge variant="secondary" className="gap-1 font-normal">
            Including recruiter posts
            <button
              aria-label="Exclude recruiter posts"
              onClick={() => setIncludeRecruiters(false)}
              className="ml-0.5 hover:text-foreground"
            >
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
              {families.length > 0
                ? "No jobs match the selected families. Try removing a family filter, broadening the title, or switching sector."
                : "No jobs found for this combination. Try broadening the title, removing some filters, or switching sector."}
            </p>
            {hasActiveFilters && (
              <div className="flex gap-2 mt-4">
                {families.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setFamilies([])}>
                    Clear families
                  </Button>
                )}
                {debouncedLocation.trim() && (
                  <Button variant="outline" size="sm" onClick={() => setLocation("")}>
                    Remove location
                  </Button>
                )}
                {sector !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => changeSector("all")}>
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
                <CompanyMonogram
                  companyName={job.companyName}
                  sector={job.sector}
                  className="hidden md:flex"
                />
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {job.sourceType === "direct_employer" && (
                        <Badge variant="outline" className="text-xs font-normal border-transparent bg-success/10 text-success">
                          Direct employer
                        </Badge>
                      )}
                      {job.sourceType === "google_jobs" && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Google Jobs
                        </Badge>
                      )}
                      {job.sourceType === "job_board" && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Job board
                        </Badge>
                      )}
                      {job.sourceType === "agency" && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Agency
                        </Badge>
                      )}
                      {job.companyKind === "recruitment_firm" && (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal border-transparent bg-warning/10 text-warning"
                          data-testid={`badge-recruitment-firm-${job.id}`}
                        >
                          Recruitment firm
                        </Badge>
                      )}
                      {!job.sourceType && job.sourceName && (
                        <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
                          {job.sourceName}
                        </Badge>
                      )}
                      <ClassificationTags
                        sectorLabel={job.sectorLabel ?? sectorLabel(job.sector)}
                        sector={job.sector}
                        familyLabels={job.familyLabels}
                        familyKeys={job.families}
                        onFamilyClick={(key) => applyFamilyFromCard(job.sector, key)}
                      />
                      {job.postedAt && (
                        <span className="text-xs inline-flex items-center gap-1 rounded-md bg-highlight-soft px-1.5 py-0.5 text-highlight-soft-foreground">
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

                <div className="flex md:flex-col items-center justify-between md:justify-start gap-2 md:border-l md:pl-6">
                  {job.applyUrl && (
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                        View details <ExternalLink className="ml-2 w-3 h-3" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setSpecListTarget({
                        id: job.id,
                        title: job.title,
                        companyName: job.companyName,
                      })
                    }
                    data-testid={`button-spec-list-${job.id}`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Spec list
                  </Button>
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

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>
              Save the current filters so you can rerun them later. Turn on
              alerts to get notified when new matching jobs are discovered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="save-search-name">Name</Label>
              <Input
                id="save-search-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. London underwriters"
                data-testid="input-save-search-name"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Filters: {savedSearchSummary({
                id: "",
                name: "",
                query: debouncedQ.trim(),
                location: debouncedLocation.trim(),
                sector: sector !== "all" ? sector : null,
                families,
                sourceType: source !== "all" ? source : null,
                includeRecruiters,
                alertEnabled: false,
                lastRunAt: null,
                createdAt: "",
              })}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-search-alerts"
                checked={saveAlerts}
                onCheckedChange={(v) => setSaveAlerts(v === true)}
                data-testid="checkbox-save-search-alerts"
              />
              <Label htmlFor="save-search-alerts" className="font-normal">
                Alert me when new matching jobs appear
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createSaved.isPending}
              data-testid="button-confirm-save-search"
            >
              {createSaved.isPending ? "Saving..." : "Save search"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {specListTarget && (
        <SendToSpecListDialog
          open={!!specListTarget}
          onClose={() => setSpecListTarget(null)}
          jobId={specListTarget.id}
          jobTitle={specListTarget.title}
          companyName={specListTarget.companyName}
        />
      )}
    </div>
  );
}
