import React, { useState } from "react";
import {
  useScrapeResearchUrl,
  useExtractResearchJob,
  type ExtractedJob,
  type ScrapedPage,
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
import { Globe, Loader2, Sparkles, FileText } from "lucide-react";
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

  const extractMutation = useExtractResearchJob();
  const scrapeMutation = useScrapeResearchUrl();
  const busy = extractMutation.isPending || scrapeMutation.isPending;

  const reset = (): void => {
    setError(null);
    setExtracted(null);
    setScraped(null);
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
