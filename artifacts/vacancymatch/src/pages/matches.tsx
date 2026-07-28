import React, { useState } from "react";
import {
  useListMatches,
  useUpdateMatch,
  usePushMatchToCrm,
  getListMatchesQueryKey,
  type Match,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClassificationTags } from "@/components/classification-tags";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  CheckCheck,
  X,
  Send,
  MapPin,
  Building2,
  ArrowRight,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { SendToSpecListDialog } from "@/components/send-to-spec-list-dialog";

// ---------------------------------------------------------------------------
// Score factor config
// ---------------------------------------------------------------------------

const SCORE_FACTORS = [
  { key: "skills" as const, label: "Skills", weight: "35%" },
  { key: "title" as const, label: "Title", weight: "20%" },
  { key: "industry" as const, label: "Industry", weight: "15%" },
  { key: "location" as const, label: "Location", weight: "15%" },
  { key: "comp" as const, label: "Salary", weight: "10%" },
  { key: "recency" as const, label: "Recency", weight: "5%" },
];

const STATUS_TABS = [
  { key: "new", label: "New" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "pushed", label: "Pushed to CRM" },
  { key: "dismissed", label: "Dismissed" },
] as const;

type StatusKey = (typeof STATUS_TABS)[number]["key"];

function factorBarClass(score: number): string {
  if (score >= 0.7) return "bg-emerald-500";
  if (score >= 0.4) return "bg-amber-400";
  return "bg-red-400";
}

function overallBadgeVariant(score: number): "default" | "secondary" | "outline" {
  if (score >= 90) return "default";
  if (score >= 75) return "secondary";
  return "outline";
}

// ---------------------------------------------------------------------------
// Score breakdown mini-grid
// ---------------------------------------------------------------------------

type BreakdownLike = { skills?: number; title?: number; industry?: number; location?: number; comp?: number; recency?: number };

function ScoreBreakdown({
  breakdown,
}: {
  breakdown: BreakdownLike;
}) {
  const values: Record<string, number> = {
    skills: breakdown.skills ?? 0,
    title: breakdown.title ?? 0,
    industry: breakdown.industry ?? 0,
    location: breakdown.location ?? 0,
    comp: breakdown.comp ?? 0,
    recency: breakdown.recency ?? 0,
  };
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {SCORE_FACTORS.map(({ key, label, weight }) => {
        const raw = values[key] ?? 0;
        const pct = Math.round(raw * 100);
        return (
          <div key={key} className="space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">
                {label}
                <span className="text-muted-foreground/50 ml-0.5">({weight})</span>
              </span>
              <span className="text-[11px] font-medium tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${factorBarClass(raw)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skills chips
// ---------------------------------------------------------------------------

function SkillChips({
  matched,
  missing,
}: {
  matched: string[];
  missing: string[];
}) {
  const showMatched = matched.slice(0, 5);
  const showMissing = missing.slice(0, 3);
  if (showMatched.length === 0 && showMissing.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {showMatched.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        >
          <CheckCheck className="w-2.5 h-2.5" />
          {s}
        </span>
      ))}
      {showMissing.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground"
        >
          <X className="w-2.5 h-2.5" />
          {s}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

interface MatchCardProps {
  match: Match;
  onShortlist: (id: string) => void;
  onDismiss: (id: string) => void;
  onPushCrm: (id: string) => void;
  isPending: boolean;
}

function MatchCard({ match, onShortlist, onDismiss, onPushCrm, isPending }: MatchCardProps) {
  const status = match.recruiterStatus as StatusKey;
  const [specListOpen, setSpecListOpen] = useState(false);

  return (
    <Card className="flex flex-col hover:border-primary/40 transition-colors">
      <CardContent className="flex flex-col gap-3 pt-4 flex-1">
        {/* ── Candidate & score header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/candidates/${match.candidateId}`}
                className="font-semibold text-base leading-tight hover:underline text-foreground truncate"
              >
                {match.candidateName ?? "Unknown Candidate"}
              </Link>
            </div>
            {match.candidateClassification && (
              <ClassificationTags
                className="mt-1"
                sectorLabel={match.candidateClassification.sectorLabel}
                sector={match.candidateClassification.sector ?? undefined}
                familyLabels={match.candidateClassification.familyLabels}
                familyKeys={match.candidateClassification.families}
              />
            )}
          </div>
          <Badge
            variant={overallBadgeVariant(match.overallScore)}
            className={`text-sm px-2 py-0.5 shrink-0 tabular-nums font-semibold ${match.overallScore >= 90 ? "glow-primary" : ""}`}
          >
            {Math.round(match.overallScore)}
          </Badge>
        </div>

        {/* ── Job ── */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <ArrowRight className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-medium leading-snug line-clamp-1">{match.job?.title ?? "Unknown Role"}</p>
            <div className="flex flex-wrap gap-x-2 text-muted-foreground text-xs mt-0.5">
              {match.job?.companyName && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {match.job.companyName}
                </span>
              )}
              {match.job?.locationText && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {match.job.locationText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Score breakdown ── */}
        <ScoreBreakdown breakdown={match.scoreBreakdown as BreakdownLike} />

        {/* ── Skills ── */}
        <SkillChips matched={match.matchedSkills} missing={match.missingSkills ?? []} />

        {/* ── First explanation line ── */}
        {match.explanation?.[0] && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {match.explanation[0]}
          </p>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 pt-1 border-t mt-auto flex-wrap">
          {status === "new" && (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1.5"
                disabled={isPending}
                onClick={() => onShortlist(match.id)}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Shortlist
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-muted-foreground"
                disabled={isPending}
                onClick={() => onDismiss(match.id)}
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </Button>
            </>
          )}
          {status === "shortlisted" && (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1.5"
                disabled={isPending}
                onClick={() => onPushCrm(match.id)}
              >
                <Send className="w-3.5 h-3.5" />
                Push to CRM
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-muted-foreground"
                disabled={isPending}
                onClick={() => onDismiss(match.id)}
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </Button>
            </>
          )}
          {status === "dismissed" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              disabled={isPending}
              onClick={() => onShortlist(match.id)}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Shortlist
            </Button>
          )}
          {status === "pushed" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Send className="w-3 h-3" /> Pushed to CRM
            </span>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setSpecListOpen(true)}
            data-testid={`button-spec-list-match-${match.id}`}
          >
            <ClipboardList className="w-3.5 h-3.5" /> Spec list
          </Button>

          <Link href={`/candidates/${match.candidateId}`} className="ml-auto">
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-muted-foreground">
              Candidate <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardContent>

      {match.job?.id && (
        <SendToSpecListDialog
          open={specListOpen}
          onClose={() => setSpecListOpen(false)}
          jobId={match.job.id}
          jobTitle={match.job.title ?? "Unknown Role"}
          companyName={match.job.companyName}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ status }: { status: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    new: {
      title: "No new matches",
      body: "New AI-generated matches appear here. Run a match from any candidate profile to get started.",
    },
    shortlisted: {
      title: "Nothing shortlisted yet",
      body: "Shortlist matches from the New tab to collect your best candidate-job pairings here.",
    },
    pushed: {
      title: "Nothing pushed to CRM",
      body: "Shortlisted matches can be pushed to your CRM with a note from the Shortlisted tab.",
    },
    dismissed: {
      title: "No dismissed matches",
      body: "Matches you dismiss appear here so you can revisit them if needed.",
    },
  };

  const { title, body } = messages[status] ?? { title: "No matches", body: "" };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Target className="w-10 h-10 text-muted-foreground/30 mb-3" />
      <h3 className="font-medium text-base">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mt-1">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Matches() {
  const [activeTab, setActiveTab] = useState<StatusKey>("new");
  const [pushTarget, setPushTarget] = useState<string | null>(null);
  const [crmName, setCrmName] = useState("");
  const [crmNote, setCrmNote] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allMatches = [], isLoading } = useListMatches();
  const updateMatch = useUpdateMatch();
  const pushCrm = usePushMatchToCrm();

  const isPending = updateMatch.isPending || pushCrm.isPending;

  // Group all matches by status for tab counts + content
  const byStatus: Record<StatusKey, typeof allMatches> = {
    new: allMatches.filter((m) => m.recruiterStatus === "new"),
    shortlisted: allMatches.filter((m) => m.recruiterStatus === "shortlisted"),
    pushed: allMatches.filter((m) => m.recruiterStatus === "pushed"),
    dismissed: allMatches.filter((m) => m.recruiterStatus === "dismissed"),
  };

  const handleStatus = (matchId: string, status: string) => {
    updateMatch.mutate(
      { id: matchId, data: { recruiterStatus: status } },
      {
        onSuccess: () => {
          const label = status === "shortlisted" ? "Shortlisted" : status === "dismissed" ? "Dismissed" : "Updated";
          toast({ title: `Match ${label.toLowerCase()}` });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        },
      },
    );
  };

  const handleOpenPushDialog = (matchId: string) => {
    setPushTarget(matchId);
    setCrmName("");
    setCrmNote("");
  };

  const handlePushCrm = () => {
    if (!pushTarget || !crmName.trim()) return;
    pushCrm.mutate(
      { id: pushTarget, data: { crmName: crmName.trim(), note: crmNote.trim() || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Pushed to CRM successfully" });
          setPushTarget(null);
          setCrmName("");
          setCrmNote("");
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Match Triage</h1>
        <p className="text-muted-foreground mt-1">
          Review AI-generated candidate–job matches and decide which to shortlist, dismiss, or push to your CRM.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusKey)}>
        <TabsList className="h-10">
          {STATUS_TABS.map((tab) => {
            const count = isLoading ? null : byStatus[tab.key].length;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                {tab.label}
                {count != null && count > 0 && (
                  <span className="rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-1.5 py-px tabular-nums leading-none">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 space-y-3">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : byStatus[tab.key].length === 0 ? (
              <EmptyState status={tab.key} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {byStatus[tab.key].map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onShortlist={(id) => handleStatus(id, "shortlisted")}
                    onDismiss={(id) => handleStatus(id, "dismissed")}
                    onPushCrm={handleOpenPushDialog}
                    isPending={isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Push to CRM dialog */}
      <Dialog
        open={!!pushTarget}
        onOpenChange={(open) => {
          if (!open) setPushTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Push to CRM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="crm-name">CRM system *</Label>
              <Input
                id="crm-name"
                placeholder="e.g. Bullhorn, Vincere, JobAdder"
                value={crmName}
                onChange={(e) => setCrmName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crm-note">Note (optional)</Label>
              <Textarea
                id="crm-note"
                placeholder="Add context for whoever picks this up..."
                rows={3}
                value={crmNote}
                onChange={(e) => setCrmNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handlePushCrm}
              disabled={!crmName.trim() || pushCrm.isPending}
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {pushCrm.isPending ? "Pushing…" : "Push to CRM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
