import React, { useState } from "react";
import {
  useListSpecLists,
  useCreateSpecList,
  useDeleteSpecList,
  useGetSpecList,
  useAddSpecListItem,
  useUpdateSpecListItem,
  useRemoveSpecListItem,
  getListSpecListsQueryKey,
  getGetSpecListQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  proposed: "Proposed",
  sent: "Sent",
  candidate_approved: "Approved",
  candidate_declined: "Declined",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  proposed: "secondary",
  sent: "outline",
  candidate_approved: "default",
  candidate_declined: "destructive",
};

interface SpecListDetailPanelProps {
  specListId: string;
  onClose: () => void;
}

function SpecListDetailPanel({ specListId, onClose }: SpecListDetailPanelProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: list, isLoading } = useGetSpecList(specListId, {
    query: { queryKey: getGetSpecListQueryKey(specListId) },
  });

  const updateItem = useUpdateSpecListItem();
  const removeItem = useRemoveSpecListItem();

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const handleStatusChange = (itemId: string, status: string) => {
    updateItem.mutate(
      {
        id: specListId,
        itemId,
        data: { status: status as "proposed" | "sent" | "candidate_approved" | "candidate_declined" },
      },
      {
        onSuccess: () => {
          toast({ title: "Status updated" });
          qc.invalidateQueries({ queryKey: getGetSpecListQueryKey(specListId) });
        },
      }
    );
  };

  const handleNoteSave = (itemId: string) => {
    updateItem.mutate(
      { id: specListId, itemId, data: { note: noteText || null } },
      {
        onSuccess: () => {
          toast({ title: "Note saved" });
          setEditingNoteId(null);
          qc.invalidateQueries({ queryKey: getGetSpecListQueryKey(specListId) });
        },
      }
    );
  };

  const handleRemove = (itemId: string) => {
    removeItem.mutate(
      { id: specListId, itemId },
      {
        onSuccess: () => {
          toast({ title: "Removed from list" });
          qc.invalidateQueries({ queryKey: getGetSpecListQueryKey(specListId) });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!list) return null;

  const items = list.items ?? [];

  return (
    <div className="mt-4 space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-6">
          No vacancies yet. Add jobs from the Ranked Matches tab.
        </p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 space-y-3 bg-muted/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {item.jobTitle}
                  </span>
                  {item.applyUrl && (
                    <a
                      href={item.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.companyName}
                  {item.locationText ? ` · ${item.locationText}` : ""}
                  {item.salaryText ? ` · ${item.salaryText}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={item.status}
                  onValueChange={(v) => handleStatusChange(item.id, v)}
                >
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(item.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {editingNoteId === item.id ? (
              <div className="space-y-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note for this vacancy..."
                  className="h-20 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleNoteSave(item.id)}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingNoteId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                {item.note ? (
                  <p className="text-xs text-muted-foreground flex-1">
                    {item.note}
                  </p>
                ) : (
                  <span className="text-xs text-muted-foreground/50 flex-1 italic">
                    No note
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 text-muted-foreground"
                  onClick={() => {
                    setEditingNoteId(item.id);
                    setNoteText(item.note ?? "");
                  }}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {item.note ? "Edit note" : "Add note"}
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

interface SpecListsTabProps {
  candidateId: string;
}

export default function SpecListsTab({ candidateId }: SpecListsTabProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: lists, isLoading } = useListSpecLists(candidateId, {
    query: { queryKey: getListSpecListsQueryKey(candidateId) },
  });

  const createList = useCreateSpecList();
  const deleteList = useDeleteSpecList();

  const [openListIds, setOpenListIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const toggleList = (id: string) => {
    setOpenListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    createList.mutate(
      { id: candidateId, data: { title: newTitle.trim() || undefined } },
      {
        onSuccess: (created) => {
          toast({ title: "Spec list created" });
          setShowCreate(false);
          setNewTitle("");
          qc.invalidateQueries({ queryKey: getListSpecListsQueryKey(candidateId) });
          setOpenListIds((prev) => new Set(prev).add(created.id));
        },
      }
    );
  };

  const handleDelete = (id: string, title: string | null) => {
    if (!confirm(`Delete list "${title || "Untitled"}"? This cannot be undone.`))
      return;
    deleteList.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "List deleted" });
          qc.invalidateQueries({ queryKey: getListSpecListsQueryKey(candidateId) });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Curated vacancy shortlists to share with this candidate.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New List
        </Button>
      </div>

      {(!lists || lists.length === 0) && (
        <div className="text-center py-12 border border-dashed rounded-xl bg-card">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-medium text-sm">No spec lists yet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Create a list, then add vacancies from the Ranked Matches tab.
          </p>
          <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create First List
          </Button>
        </div>
      )}

      {lists?.map((list) => {
        const isOpen = openListIds.has(list.id);
        return (
          <Card key={list.id} className="overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={() => toggleList(list.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="py-4 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <CardTitle className="text-base font-medium truncate">
                        {list.title || "Untitled List"}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {list.itemCount} {list.itemCount === 1 ? "job" : "jobs"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {formatDistanceToNow(new Date(list.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(list.id, list.title ?? null);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4">
                  <SpecListDetailPanel
                    specListId={list.id}
                    onClose={() => toggleList(list.id)}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Spec List</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Title (optional)</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Senior roles Q3, Lloyd's Market..."
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createList.isPending}>
              {createList.isPending ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
