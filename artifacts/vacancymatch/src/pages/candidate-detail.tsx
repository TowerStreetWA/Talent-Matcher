import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetCandidate, 
  useUpdateCandidate, 
  useDeleteCandidate, 
  useRunMatch, 
  useListCandidateMatches,
  useUpdateMatch,
  usePushMatchToCrm,
  useCreateAlertRule,
  useListSpecLists,
  useCreateSpecList,
  useAddSpecListItem,
  getGetCandidateQueryKey,
  getListCandidateMatchesQueryKey,
  getListSpecListsQueryKey,
  getGetSpecListQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { 
  Briefcase, 
  MapPin, 
  Mail, 
  Phone, 
  Target, 
  Play, 
  Check, 
  X, 
  MessageSquare, 
  ArrowRightLeft, 
  Trash2, 
  BellRing,
  Pencil,
  Save,
  Clock,
  Download,
  ListPlus,
  Plus,
} from "lucide-react";
import SpecListsTab from "@/components/SpecListsTab";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: candidate, isLoading: loadingCandidate } = useGetCandidate(id, {
    query: { enabled: !!id, queryKey: getGetCandidateQueryKey(id) }
  });
  
  const { data: matches, isLoading: loadingMatches } = useListCandidateMatches(id, {
    query: { enabled: !!id, queryKey: getListCandidateMatchesQueryKey(id) }
  });

  const updateCandidate = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const runMatch = useRunMatch();
  const updateMatch = useUpdateMatch();
  const pushCrm = usePushMatchToCrm();
  const createAlert = useCreateAlertRule();
  const addSpecListItem = useAddSpecListItem();
  const createSpecList = useCreateSpecList();

  const { data: specLists } = useListSpecLists(id, {
    query: { enabled: !!id, queryKey: getListSpecListsQueryKey(id) },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  
  const [crmName, setCrmName] = useState("");
  const [crmNote, setCrmNote] = useState("");
  const [pushMatchId, setPushMatchId] = useState<string | null>(null);

  const [addToListVacancyId, setAddToListVacancyId] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState("");

  const handleEditStart = () => {
    if (candidate) {
      setEditForm({
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        currentTitle: candidate.currentTitle || "",
        currentCompany: candidate.currentCompany || "",
        locationText: candidate.locationText || "",
        summary: candidate.summary || ""
      });
      setIsEditing(true);
    }
  };

  const handleEditSave = () => {
    updateCandidate.mutate({ id, data: editForm }, {
      onSuccess: () => {
        toast({ title: "Candidate updated" });
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getGetCandidateQueryKey(id) });
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Delete this candidate completely?")) {
      deleteCandidate.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Candidate deleted" });
          setLocation("/candidates");
        }
      });
    }
  };

  const handleRunMatch = () => {
    runMatch.mutate({ id }, {
      onSuccess: () => {
        track("match_run_completed", { trigger: "manual" });
        toast({ title: "Match run started", description: "Scanning live jobs..." });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: getListCandidateMatchesQueryKey(id) });
        }, 2000);
      }
    });
  };

  const handleMatchStatus = (matchId: string, status: string) => {
    updateMatch.mutate({ id: matchId, data: { recruiterStatus: status } }, {
      onSuccess: () => {
        track("match_status_updated", { status });
        toast({ title: `Match ${status}` });
        queryClient.invalidateQueries({ queryKey: getListCandidateMatchesQueryKey(id) });
      }
    });
  };

  const handlePushCrm = () => {
    if (!pushMatchId || !crmName) return;
    pushCrm.mutate({ id: pushMatchId, data: { crmName, note: crmNote } }, {
      onSuccess: () => {
        toast({ title: "Pushed to CRM successfully" });
        setPushMatchId(null);
        setCrmName("");
        setCrmNote("");
        queryClient.invalidateQueries({ queryKey: getListCandidateMatchesQueryKey(id) });
      }
    });
  };

  const handleCreateAlert = () => {
    createAlert.mutate({ data: { candidateId: id, minScore: 80, frequency: "daily", isActive: true } }, {
      onSuccess: () => {
        toast({ title: "Alert created", description: "You will be notified of new matches daily." });
      }
    });
  };

  if (loadingCandidate) {
    return <div className="space-y-6">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>;
  }

  if (!candidate) {
    return <div>Candidate not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 border rounded-xl shadow-sm">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-serif text-3xl font-medium tracking-tight">{candidate.firstName} {candidate.lastName}</h1>
            <Badge variant={candidate.status === 'active' ? 'default' : 'secondary'}>{candidate.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {candidate.currentTitle && (
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Briefcase className="w-4 h-4" /> {candidate.currentTitle} {candidate.currentCompany ? `at ${candidate.currentCompany}` : ''}
              </span>
            )}
            {candidate.locationText && (
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {candidate.locationText}</span>
            )}
            {candidate.email && (
              <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {candidate.email}</span>
            )}
            {candidate.phone && (
              <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {candidate.phone}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {candidate.cvFileKey && (
            <Button variant="outline" asChild>
              <a href={`${import.meta.env.BASE_URL}api/candidates/${candidate.id}/cv-file`} download>
                <Download className="w-4 h-4 mr-2" /> CV
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={handleCreateAlert}>
            <BellRing className="w-4 h-4 mr-2" /> Alert
          </Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
          <Button onClick={handleRunMatch} disabled={runMatch.isPending}>
            {runMatch.isPending ? "Running..." : <><Play className="w-4 h-4 mr-2" /> Run Match</>}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList>
          <TabsTrigger value="matches">Ranked Matches</TabsTrigger>
          <TabsTrigger value="spec-lists">Spec Lists</TabsTrigger>
          <TabsTrigger value="profile">Profile & Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-6 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Latest Match Run</h3>
            {candidate.lastMatchedAt && (
              <span className="text-sm text-muted-foreground">
                Last run: {formatDistanceToNow(new Date(candidate.lastMatchedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {loadingMatches ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : matches?.length === 0 ? (
            <div className="text-center p-12 border border-dashed rounded-xl bg-card">
              <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No matches found</h3>
              <p className="text-muted-foreground text-sm mt-1">Run a new match against the live job market.</p>
              <Button className="mt-4" onClick={handleRunMatch}>Run Match</Button>
            </div>
          ) : (
            matches?.map(match => (
              <Card key={match.id} className="overflow-hidden border-primary/10">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="flex-1 p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{match.job?.sourceName}</Badge>
                            {match.job?.postedAt && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(match.job.postedAt))} ago
                              </span>
                            )}
                          </div>
                          <h4 className="text-xl font-semibold"><a href={match.job?.applyUrl || "#"} target="_blank" rel="noreferrer" className="hover:underline">{match.job?.title}</a></h4>
                          <p className="text-muted-foreground text-sm">{match.job?.companyName} • {match.job?.locationText}</p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className={`text-3xl font-bold tracking-tighter tabular-nums text-primary ${match.overallScore >= 90 ? "glow-score" : ""}`}>{match.overallScore}</div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Match Score</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs py-3 border-y border-dashed">
                        <div><span className="block text-muted-foreground mb-1">Skills</span><Progress value={match.scoreBreakdown.skills * 100} className="h-1.5" /></div>
                        <div><span className="block text-muted-foreground mb-1">Title</span><Progress value={match.scoreBreakdown.title * 100} className="h-1.5" /></div>
                        <div><span className="block text-muted-foreground mb-1">Industry</span><Progress value={match.scoreBreakdown.industry * 100} className="h-1.5" /></div>
                        <div><span className="block text-muted-foreground mb-1">Location</span><Progress value={match.scoreBreakdown.location * 100} className="h-1.5" /></div>
                        <div><span className="block text-muted-foreground mb-1">Comp</span><Progress value={match.scoreBreakdown.comp * 100} className="h-1.5" /></div>
                        <div><span className="block text-muted-foreground mb-1">Recency</span><Progress value={match.scoreBreakdown.recency * 100} className="h-1.5" /></div>
                      </div>

                      <div className="space-y-2">
                        {match.explanation.map((line, i) => (
                          <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                            <p>{line}</p>
                          </div>
                        ))}
                      </div>

                      {(match.matchedSkills.length > 0 || (match.missingSkills && match.missingSkills.length > 0)) && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {match.matchedSkills.map(s => <Badge key={s} variant="secondary" className="bg-success/10 text-success font-normal"><Check className="w-3 h-3 mr-1" />{s}</Badge>)}
                          {match.missingSkills?.map(s => <Badge key={s} variant="secondary" className="bg-destructive/10 text-destructive font-normal"><X className="w-3 h-3 mr-1" />{s}</Badge>)}
                        </div>
                      )}
                    </div>
                    
                    <div className="w-full md:w-48 bg-muted/30 border-t md:border-t-0 md:border-l p-4 flex flex-col justify-center gap-2">
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Status</span>
                        <div className="font-medium capitalize">{match.recruiterStatus}</div>
                      </div>
                      
                      <Button variant="default" size="sm" className="w-full justify-start" onClick={() => handleMatchStatus(match.id, 'shortlisted')}>
                        <Check className="w-4 h-4 mr-2" /> Shortlist
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => setPushMatchId(match.id)}>
                            <ArrowRightLeft className="w-4 h-4 mr-2" /> Push to CRM
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Push Candidate to CRM</DialogTitle>
                            <DialogDescription>Send this candidate and match details to an external ATS/CRM.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">CRM Integration Name</label>
                              <Input value={crmName} onChange={e => setCrmName(e.target.value)} placeholder="e.g. Bullhorn, Greenhouse" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Note (Optional)</label>
                              <Textarea value={crmNote} onChange={e => setCrmNote(e.target.value)} placeholder="Add a note for the CRM..." />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handlePushCrm} disabled={!crmName}>Push Data</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:bg-destructive/10" onClick={() => handleMatchStatus(match.id, 'dismissed')}>
                        <X className="w-4 h-4 mr-2" /> Dismiss
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          setAddToListVacancyId(match.jobId ?? null);
                          setNewListTitle("");
                        }}
                      >
                        <ListPlus className="w-4 h-4 mr-2" /> Add to List
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="spec-lists" className="mt-6">
          <SpecListsTab candidateId={id} />
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Structured Profile</CardTitle>
                <CardDescription>Parsed details from CV.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => isEditing ? handleEditSave() : handleEditStart()}>
                {isEditing ? <><Save className="w-4 h-4 mr-2" /> Save</> : <><Pencil className="w-4 h-4 mr-2" /> Edit</>}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">First Name</label>
                      <Input value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Last Name</label>
                      <Input value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Current Title</label>
                      <Input value={editForm.currentTitle} onChange={e => setEditForm({...editForm, currentTitle: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Current Company</label>
                      <Input value={editForm.currentCompany} onChange={e => setEditForm({...editForm, currentCompany: e.target.value})} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-sm font-medium">Location</label>
                      <Input value={editForm.locationText} onChange={e => setEditForm({...editForm, locationText: e.target.value})} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-sm font-medium">Summary</label>
                      <Textarea value={editForm.summary} onChange={e => setEditForm({...editForm, summary: e.target.value})} className="h-32" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Summary</h4>
                    <p className="text-sm leading-relaxed">{candidate.summary || "No summary available."}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Extracted Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Target Titles</h4>
                      <ul className="space-y-1 text-sm">
                        {candidate.titles.map((t, i) => <li key={i} className="flex items-center gap-2"><Target className="w-3 h-3 text-primary" /> {t}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Preferences</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Remote Work</span>
                          <span className="font-medium capitalize">{candidate.remotePreference || 'Any'}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Desired Salary</span>
                          <span className="font-medium">
                            {candidate.desiredSalaryMin ? `${candidate.salaryCurrency || '$'}${candidate.desiredSalaryMin.toLocaleString()} - ${candidate.desiredSalaryMax ? candidate.desiredSalaryMax.toLocaleString() : '+'}` : 'Not specified'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                          <span className="text-muted-foreground">Seniority</span>
                          <span className="font-medium capitalize">{candidate.seniority || 'Any'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add to Spec List dialog */}
      <Dialog
        open={!!addToListVacancyId}
        onOpenChange={(open) => !open && setAddToListVacancyId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Spec List</DialogTitle>
            <DialogDescription>
              Choose an existing list or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {specLists && specLists.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Existing lists</p>
                {specLists.map((list) => (
                  <Button
                    key={list.id}
                    variant="outline"
                    className="w-full justify-between"
                    disabled={addSpecListItem.isPending}
                    onClick={() => {
                      if (!addToListVacancyId) return;
                      addSpecListItem.mutate(
                        { id: list.id, data: { vacancyId: addToListVacancyId } },
                        {
                          onSuccess: () => {
                            toast({ title: `Added to "${list.title || "Untitled List"}"` });
                            queryClient.invalidateQueries({
                              queryKey: getGetSpecListQueryKey(list.id),
                            });
                            queryClient.invalidateQueries({
                              queryKey: getListSpecListsQueryKey(id),
                            });
                            setAddToListVacancyId(null);
                          },
                          onError: () => {
                            toast({
                              title: "Could not add vacancy",
                              description: "It may already be in this list.",
                              variant: "destructive",
                            });
                          },
                        }
                      );
                    }}
                  >
                    <span className="truncate">{list.title || "Untitled List"}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                      {list.itemCount}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">Create new list</p>
              <div className="flex gap-2">
                <Input
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="List title (optional)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addToListVacancyId) {
                      createSpecList.mutate(
                        { id, data: { title: newListTitle.trim() || undefined } },
                        {
                          onSuccess: (created) => {
                            queryClient.invalidateQueries({
                              queryKey: getListSpecListsQueryKey(id),
                            });
                            addSpecListItem.mutate(
                              { id: created.id, data: { vacancyId: addToListVacancyId! } },
                              {
                                onSuccess: () => {
                                  toast({ title: `Added to "${created.title || "New List"}"` });
                                  queryClient.invalidateQueries({
                                    queryKey: getGetSpecListQueryKey(created.id),
                                  });
                                  setAddToListVacancyId(null);
                                },
                              }
                            );
                          },
                        }
                      );
                    }
                  }}
                />
                <Button
                  disabled={createSpecList.isPending || addSpecListItem.isPending}
                  onClick={() => {
                    if (!addToListVacancyId) return;
                    createSpecList.mutate(
                      { id, data: { title: newListTitle.trim() || undefined } },
                      {
                        onSuccess: (created) => {
                          queryClient.invalidateQueries({
                            queryKey: getListSpecListsQueryKey(id),
                          });
                          addSpecListItem.mutate(
                            { id: created.id, data: { vacancyId: addToListVacancyId! } },
                            {
                              onSuccess: () => {
                                toast({ title: `Added to "${created.title || "New List"}"` });
                                queryClient.invalidateQueries({
                                  queryKey: getGetSpecListQueryKey(created.id),
                                });
                                setAddToListVacancyId(null);
                              },
                            }
                          );
                        },
                      }
                    );
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Create
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
