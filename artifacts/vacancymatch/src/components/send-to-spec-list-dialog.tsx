import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useListSpecFolders,
  useAddSpecFolderItem,
  getListSpecFolderItemsQueryKey,
  getListSpecFoldersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Loader2 } from "lucide-react";

interface SendToSpecListDialogProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  companyName?: string | null;
}

export function SendToSpecListDialog({
  open,
  onClose,
  jobId,
  jobTitle,
  companyName,
}: SendToSpecListDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [note, setNote] = useState("");

  const { data: folders = [], isLoading: foldersLoading } = useListSpecFolders({
    query: { enabled: open, queryKey: getListSpecFoldersQueryKey() },
  });

  const addItem = useAddSpecFolderItem();

  function handleClose() {
    setSelectedFolderId("");
    setNote("");
    onClose();
  }

  async function handleSubmit() {
    if (!selectedFolderId) return;
    addItem.mutate(
      { id: selectedFolderId, data: { jobId, note: note || undefined } },
      {
        onSuccess: () => {
          toast({
            title: "Added to spec list",
            description: `"${jobTitle}" added — contacts are being enriched in the background.`,
          });
          qc.invalidateQueries({ queryKey: getListSpecFolderItemsQueryKey(selectedFolderId) });
          qc.invalidateQueries({ queryKey: getListSpecFoldersQueryKey() });
          handleClose();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Failed to add job";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      },
    );
  }

  const teamFolders = folders.filter((f) => f.visibility === "team");
  const personalFolders = folders.filter((f) => f.visibility === "personal");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList size={18} />
            Add to Spec List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-1">{jobTitle}</p>
            {companyName && (
              <p className="text-xs text-muted-foreground">{companyName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder-select">Folder</Label>
            {foldersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Loading folders…
              </div>
            ) : (
              <Select
                value={selectedFolderId}
                onValueChange={setSelectedFolderId}
              >
                <SelectTrigger id="folder-select" data-testid="select-folder">
                  <SelectValue placeholder="Select a folder…" />
                </SelectTrigger>
                <SelectContent>
                  {teamFolders.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                        Team
                      </div>
                      {teamFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {personalFolders.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                        My Lists
                      </div>
                      {personalFolders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {folders.length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      No folders yet — create one in the Spec List page.
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-input">Note (optional)</Label>
            <Textarea
              id="note-input"
              data-testid="input-spec-note"
              placeholder="Any notes about this vacancy…"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-spec">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedFolderId || addItem.isPending}
            data-testid="button-confirm-spec"
          >
            {addItem.isPending ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : null}
            Add to List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
