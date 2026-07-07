import React, { useState } from "react";
import {
  useScrapeResearchUrl,
  useExtractResearchJob,
  searchResearchCompanies,
  getResearchCompanyProfile,
  type ExtractedJob,
  type ScrapedPage,
  type CompanySearchResult,
  type CompanyProfile,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, Sparkles, FileText, Building2, SearchCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { track } from "@/lib/analytics";

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

const FIELD_LABELS: Array<{ key: keyof ExtractedJob; label: string }> = [
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "location", label: "Location" },
  { key: "salaryText", label: "Salary" },
  { key: "contractType", label: "Contract" },
  { key: "experienceLevel", label: "Experience" },
  { key: "remoteType", label: "Remote" },
];

export function ResearchUrlDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedJob | null>(null);
  const [scraped, setScraped] = useState<ScrapedPage | null>(null);

  const [companyQuery, setCompanyQuery] = useState("");
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyResults, setCompanyResults] = useState<CompanySearchResult[] | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companySearching, setCompanySearching] = useState(false);
  const [profileLoading, setProfileLoading] = useState<string | null>(null);

  const extractMutation = useExtractResearchJob();
  const scrapeMutation = useScrapeResearchUrl();
  const busy = extractMutation.isPending || scrapeMutation.isPending;

  const reset = (): void => {
    setError(null);
    setExtracted(null);
    setScraped(null);
  };

  const resetCompany = (): void => {
    setCompanyError(null);
    setCompanyResults(null);
    setCompanyProfile(null);
  };

  const handleCompanySearch = async (): Promise<void> => {
    resetCompany();
    setCompanySearching(true);
    track("research_company_search", { queryLength: companyQuery.trim().length });
    try {
      const results = await searchResearchCompanies({ query: companyQuery.trim() });
      setCompanyResults(results);
    } catch (err) {
      setCompanyError(errorMessage(err));
    } finally {
      setCompanySearching(false);
    }
  };

  const handleCompanyProfile = async (companyNumber: string): Promise<void> => {
    setCompanyError(null);
    setCompanyProfile(null);
    setProfileLoading(companyNumber);
    track("research_company_profile_viewed", {});
    try {
      const profile = await getResearchCompanyProfile(companyNumber);
      setCompanyProfile(profile);
    } catch (err) {
      setCompanyError(errorMessage(err));
    } finally {
      setProfileLoading(null);
    }
  };

  const handleExtract = async (): Promise<void> => {
    reset();
    track("research_extract_started", { hasUrl: url.trim().length > 0 });
    try {
      const job = await extractMutation.mutateAsync({ data: { url: url.trim() } });
      setExtracted(job);
      track("research_extract_succeeded", { hasTitle: job.title != null });
    } catch (err) {
      setError(errorMessage(err));
      track("research_extract_failed", {});
    }
  };

  const handleScrape = async (): Promise<void> => {
    reset();
    try {
      const page = await scrapeMutation.mutateAsync({ data: { url: url.trim() } });
      setScraped(page);
      track("research_scrape_succeeded", { contentLength: page.markdown.length });
    } catch (err) {
      setError(errorMessage(err));
      track("research_scrape_failed", {});
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setUrl("");
          reset();
          setCompanyQuery("");
          resetCompany();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 gap-2">
          <Globe className="h-4 w-4" />
          Research URL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Research a vacancy URL</DialogTitle>
          <DialogDescription>
            Paste a link to a live job posting to pull in its details or preview its content.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://company.com/careers/role"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !busy) void handleExtract();
              }}
            />
            <div className="flex gap-2">
              <Button onClick={() => void handleExtract()} disabled={!url.trim() || busy} className="gap-2">
                {extractMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Extract job
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleScrape()}
                disabled={!url.trim() || busy}
                className="gap-2"
              >
                {scrapeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Preview page
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md p-3">
              {error}
            </p>
          )}

          {extracted && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{extracted.title ?? "Untitled role"}</h3>
                <Badge variant="secondary">Extracted</Badge>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {FIELD_LABELS.map(({ key, label }) => {
                  const value = extracted[key];
                  if (typeof value !== "string" || !value) return null;
                  return (
                    <div key={key} className="flex gap-2">
                      <dt className="text-muted-foreground w-24 shrink-0">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  );
                })}
              </dl>
              {extracted.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extracted.skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
              {extracted.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-6">
                  {extracted.description}
                </p>
              )}
              {extracted.confidenceNotes && (
                <p className="text-xs text-muted-foreground italic">{extracted.confidenceNotes}</p>
              )}
            </div>
          )}

          {scraped && (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{scraped.metadata.title ?? "Page preview"}</h3>
                <Badge variant="secondary">Preview</Badge>
              </div>
              {scraped.metadata.description && (
                <p className="text-sm text-muted-foreground">{scraped.metadata.description}</p>
              )}
              <pre className="text-xs bg-muted rounded-md p-3 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {scraped.contentPreview || "(no content)"}
              </pre>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">UK company check</h3>
              <span className="text-xs text-muted-foreground">via Companies House</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
                placeholder="Company name, e.g. Monzo Bank"
                disabled={companySearching}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && companyQuery.trim().length >= 2 && !companySearching) {
                    void handleCompanySearch();
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => void handleCompanySearch()}
                disabled={companyQuery.trim().length < 2 || companySearching}
                className="gap-2 shrink-0"
              >
                {companySearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SearchCheck className="h-4 w-4" />
                )}
                Check company
              </Button>
            </div>

            {companyError && (
              <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md p-3">
                {companyError}
              </p>
            )}

            {companyResults && companyResults.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No registered UK companies matched that name.
              </p>
            )}

            {companyResults && companyResults.length > 0 && (
              <ul className="space-y-1.5">
                {companyResults.map((c) => (
                  <li key={c.companyNumber}>
                    <button
                      type="button"
                      onClick={() => void handleCompanyProfile(c.companyNumber)}
                      className="w-full text-left rounded-md border p-2.5 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="flex items-center gap-2">
                          {profileLoading === c.companyNumber && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          {c.status && (
                            <Badge
                              variant={c.status === "active" ? "secondary" : "outline"}
                              className="text-xs capitalize"
                            >
                              {c.status}
                            </Badge>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        #{c.companyNumber}
                        {c.incorporationDate ? ` · Incorporated ${c.incorporationDate}` : ""}
                        {c.addressSnippet ? ` · ${c.addressSnippet}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {companyProfile && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold">{companyProfile.name}</h4>
                  {companyProfile.status && (
                    <Badge
                      variant={companyProfile.status === "active" ? "secondary" : "destructive"}
                      className="capitalize"
                    >
                      {companyProfile.status}
                    </Badge>
                  )}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">Company no.</dt>
                    <dd className="font-medium">{companyProfile.companyNumber}</dd>
                  </div>
                  {companyProfile.incorporationDate && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-28 shrink-0">Incorporated</dt>
                      <dd className="font-medium">{companyProfile.incorporationDate}</dd>
                    </div>
                  )}
                  {companyProfile.companyType && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-28 shrink-0">Type</dt>
                      <dd className="font-medium">{companyProfile.companyType}</dd>
                    </div>
                  )}
                  {companyProfile.registeredOfficeLocality && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-28 shrink-0">Registered in</dt>
                      <dd className="font-medium">{companyProfile.registeredOfficeLocality}</dd>
                    </div>
                  )}
                  {companyProfile.lastAccountsDate && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-28 shrink-0">Last accounts</dt>
                      <dd className="font-medium">{companyProfile.lastAccountsDate}</dd>
                    </div>
                  )}
                </dl>
                {companyProfile.sicCodes.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Sector</p>
                    <div className="flex flex-wrap gap-1.5">
                      {companyProfile.sicCodes.map((sic) => (
                        <Badge key={sic.code} variant="outline" className="text-xs" title={`SIC ${sic.code}`}>
                          {sic.description}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
