import { useState } from "react";
import {
  useListSpecFolders,
  useCreateSpecFolder,
  useUpdateSpecFolder,
  useDeleteSpecFolder,
  useListSpecFolderItems,
  useRemoveSpecFolderItem,
  useEnrichSpecFolderItem,
  useCreateSpecFolderContact,
  useUpdateSpecFolderContact,
  useDeleteSpecFolderContact,
  useListSpecSearchConfigs,
  useCreateSpecSearchConfig,
  useUpdateSpecSearchConfig,
  useDeleteSpecSearchConfig,
  getListSpecFoldersQueryKey,
  getListSpecFolderItemsQueryKey,
  getListSpecSearchConfigsQueryKey,
  type JobSpecFolder,
  type JobSpecFolderItem,
  type JobSpecContact,
  type JobSpecSearchConfig,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList,
  Plus,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  UserPlus,
  Mail,
  Phone,
  Linkedin,
  Building2,
  MapPin,
  Banknote,
  ExternalLink,
  Pencil,
  Loader2,
  Users,
  Briefcase,
  ChevronRight,
  Settings,
  Folder,
  FolderOpen,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Folder sidebar
// ---------------------------------------------------------------------------
function FolderSidebar({
  folders,
  selectedId,
  onSelect,
  onNew,
  loading,
  tab,
}: {
  folders: JobSpecFolder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  loading: boolean;
  tab: "team" | "personal";
}) {
  const filtered = folders.filter((f) =>
    tab === "team" ? f.visibility === "team" : f.visibility === "personal",
  );

  return (
    <div className="w-56 shrink-0 space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tab === "team" ? "Team Folders" : "My Folders"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onNew}
          data-testid="button-new-folder"
          title="New folder"
        >
          <Plus size={14} />
        </Button>
      </div>
      {loading ? (
        <div className="space-y-1">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No {tab === "team" ? "team" : "personal"} folders yet.
        </p>
      ) : (
        filtered.map((f) => {
          const active = f.id === selectedId;
          return (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              data-testid={`button-folder-${f.id}`}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              {active ? (
                <FolderOpen size={14} />
              ) : (
                <Folder size={14} />
              )}
              <span className="truncate flex-1">{f.name}</span>
              <span
                className={`text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}
              >
                {f.itemCount}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact pill
// ---------------------------------------------------------------------------
function ContactPill({
  contact,
  onEdit,
  onDelete,
}: {
  contact: JobSpecContact;
  onEdit: (c: JobSpecContact) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm"
      data-testid={`contact-pill-${contact.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium truncate">{contact.fullName}</span>
          {contact.confidence === "best_guess" && (
            <Badge variant="outline" className="text-[10px] h-4">
              best guess
            </Badge>
          )}
          {contact.source === "manual" && (
            <Badge variant="outline" className="text-[10px] h-4">
              manual
            </Badge>
          )}
        </div>
        {contact.title && (
          <p className="text-xs text-muted-foreground truncate">{contact.title}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid={`link-contact-email-${contact.id}`}
            >
              <Mail size={11} /> {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              <Phone size={11} /> {contact.phone}
            </a>
          )}
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              data-testid={`link-contact-linkedin-${contact.id}`}
            >
              <Linkedin size={11} /> LinkedIn
            </a>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => onEdit(contact)}
          data-testid={`button-edit-contact-${contact.id}`}
          title="Edit contact"
        >
          <Pencil size={12} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => onDelete(contact.id)}
          data-testid={`button-delete-contact-${contact.id}`}
          title="Delete contact"
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder item card
// ---------------------------------------------------------------------------
function FolderItemCard({
  item,
  onRemove,
  onEnrich,
  onAddContact,
  onEditContact,
  onDeleteContact,
}: {
  item: JobSpecFolderItem;
  onRemove: (id: string) => void;
  onEnrich: (id: string) => void;
  onAddContact: (itemId: string) => void;
  onEditContact: (c: JobSpecContact) => void;
  onDeleteContact: (contactId: string) => void;
}) {
  const taContacts = item.contacts.filter((c) => c.contactType === "talent_acquisition");
  const hmContacts = item.contacts.filter((c) => c.contactType === "hiring_manager");

  return (
    <Card
      className="mb-3"
      data-testid={`card-spec-item-${item.id}`}
    >
      <CardContent className="pt-4 pb-3">
        {/* Job header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight">
              {item.job.title}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-muted-foreground">
              {item.job.companyName && (
                <span className="flex items-center gap-1">
                  <Building2 size={11} /> {item.job.companyName}
                </span>
              )}
              {item.job.locationText && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {item.job.locationText}
                </span>
              )}
              {item.job.salaryText && (
                <span className="flex items-center gap-1">
                  <Banknote size={11} /> {item.job.salaryText}
                </span>
              )}
              {item.job.sectorTag && (
                <Badge variant="secondary" className="text-[10px] h-4 capitalize">
                  {item.job.sectorTag.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {item.job.applyUrl && (
              <a
                href={item.job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-spec-apply-${item.id}`}
              >
                <Button size="icon" variant="ghost" className="h-7 w-7" title="View job">
                  <ExternalLink size={13} />
                </Button>
              </a>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  data-testid={`button-item-menu-${item.id}`}
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onEnrich(item.id)}
                  data-testid={`menu-enrich-${item.id}`}
                >
                  <RefreshCw size={13} className="mr-2" /> Re-run contact search
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAddContact(item.id)}
                  data-testid={`menu-add-contact-${item.id}`}
                >
                  <UserPlus size={13} className="mr-2" /> Add contact manually
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onRemove(item.id)}
                  data-testid={`menu-remove-item-${item.id}`}
                >
                  <Trash2 size={13} className="mr-2" /> Remove from folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {item.note && (
          <p className="text-xs text-muted-foreground italic mb-2 border-l-2 border-border pl-2">
            {item.note}
          </p>
        )}

        {/* Contacts */}
        {item.contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-2 italic">
            No contacts found yet — enrichment may still be running.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {taContacts.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <Users size={11} /> Talent Acquisition
                </div>
                <div className="space-y-1">
                  {taContacts.map((c) => (
                    <ContactPill
                      key={c.id}
                      contact={c}
                      onEdit={onEditContact}
                      onDelete={onDeleteContact}
                    />
                  ))}
                </div>
              </div>
            )}
            {hmContacts.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                  <Briefcase size={11} /> Hiring Manager
                </div>
                <div className="space-y-1">
                  {hmContacts.map((c) => (
                    <ContactPill
                      key={c.id}
                      contact={c}
                      onEdit={onEditContact}
                      onDelete={onDeleteContact}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit contact dialog
// ---------------------------------------------------------------------------
function ContactDialog({
  open,
  initial,
  itemId,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: JobSpecContact | null;
  itemId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedinUrl ?? "");
  const [contactType, setContactType] = useState<"talent_acquisition" | "hiring_manager">(
    initial?.contactType === "hiring_manager" ? "hiring_manager" : "talent_acquisition",
  );

  const createContact = useCreateSpecFolderContact();
  const updateContact = useUpdateSpecFolderContact();

  const isEdit = !!initial;

  function reset() {
    setFullName(""); setTitle(""); setEmail(""); setPhone(""); setLinkedinUrl("");
    setContactType("talent_acquisition");
  }

  function handleClose() { reset(); onClose(); }

  async function handleSave() {
    const payload = {
      fullName,
      title: title || null,
      email: email || null,
      phone: phone || null,
      linkedinUrl: linkedinUrl || null,
      contactType,
      confidence: "high" as const,
    };

    if (isEdit && initial) {
      updateContact.mutate(
        { contactId: initial.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Contact updated" }); onSaved(); handleClose(); },
          onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
        },
      );
    } else if (itemId) {
      createContact.mutate(
        { itemId, data: payload },
        {
          onSuccess: () => { toast({ title: "Contact added" }); onSaved(); handleClose(); },
          onError: () => toast({ title: "Error", description: "Failed to add", variant: "destructive" }),
        },
      );
    }
  }

  const isPending = createContact.isPending || updateContact.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Full name *</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              data-testid="input-contact-name"
            />
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Head of Talent"
              data-testid="input-contact-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900000"
                data-testid="input-contact-phone"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>LinkedIn URL</Label>
            <Input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              data-testid="input-contact-linkedin"
            />
          </div>
          <div className="space-y-1">
            <Label>Contact type</Label>
            <Select
              value={contactType}
              onValueChange={(v) =>
                setContactType(v as "talent_acquisition" | "hiring_manager")
              }
            >
              <SelectTrigger data-testid="select-contact-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="talent_acquisition">Talent Acquisition</SelectItem>
                <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!fullName || isPending}
            data-testid="button-save-contact"
          >
            {isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            {isEdit ? "Save" : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// New / rename folder dialog
// ---------------------------------------------------------------------------
function FolderDialog({
  open,
  existing,
  defaultVisibility,
  onClose,
  onSaved,
}: {
  open: boolean;
  existing: JobSpecFolder | null;
  defaultVisibility: "team" | "personal";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [visibility, setVisibility] = useState<"team" | "personal">(
    existing?.visibility === "personal" ? "personal" : defaultVisibility,
  );

  const createFolder = useCreateSpecFolder();
  const updateFolder = useUpdateSpecFolder();

  function handleClose() { setName(""); onClose(); }

  function handleSave() {
    const payload = { name, visibility };
    if (existing) {
      updateFolder.mutate(
        { id: existing.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Folder renamed" });
            qc.invalidateQueries({ queryKey: getListSpecFoldersQueryKey() });
            onSaved(); handleClose();
          },
        },
      );
    } else {
      createFolder.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Folder created" });
            qc.invalidateQueries({ queryKey: getListSpecFoldersQueryKey() });
            onSaved(); handleClose();
          },
        },
      );
    }
  }

  const isPending = createFolder.isPending || updateFolder.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Rename Folder" : "New Folder"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 Insurance Prospects"
              data-testid="input-folder-name"
              onKeyDown={(e) => e.key === "Enter" && name && handleSave()}
            />
          </div>
          {!existing && (
            <div className="space-y-1">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as "team" | "personal")}
              >
                <SelectTrigger data-testid="select-folder-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Team — visible to everyone</SelectItem>
                  <SelectItem value="personal">Personal — just me</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!name || isPending}
            data-testid="button-save-folder"
          >
            {isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            {existing ? "Rename" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Settings tab — search configs
// ---------------------------------------------------------------------------
function SearchConfigRow({
  config,
  onEdit,
  onDelete,
}: {
  config: JobSpecSearchConfig;
  onEdit: (c: JobSpecSearchConfig) => void;
  onDelete: (id: string) => void;
}) {
  const scope =
    config.sectorTag
      ? `Sector: ${config.sectorTag}`
      : config.jobTitleKeyword
        ? `Title keyword: ${config.jobTitleKeyword}`
        : "Tenant default";
  return (
    <tr
      className="border-b border-border text-sm"
      data-testid={`row-search-config-${config.id}`}
    >
      <td className="py-2 pr-4 font-medium">{scope}</td>
      <td className="py-2 pr-4 text-muted-foreground text-xs">
        {config.targetTitles.slice(0, 3).join(", ")}
        {config.targetTitles.length > 3 ? ` +${config.targetTitles.length - 3}` : ""}
      </td>
      <td className="py-2 pr-4 text-muted-foreground text-xs">
        {config.managerTitles.slice(0, 3).join(", ")}
        {config.managerTitles.length > 3 ? ` +${config.managerTitles.length - 3}` : ""}
      </td>
      <td className="py-2 text-right">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 mr-1"
          onClick={() => onEdit(config)}
          data-testid={`button-edit-config-${config.id}`}
        >
          <Pencil size={12} className="mr-1" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(config.id)}
          data-testid={`button-delete-config-${config.id}`}
        >
          <Trash2 size={12} />
        </Button>
      </td>
    </tr>
  );
}

function ConfigDialog({
  open,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  existing: JobSpecSearchConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sectorTag, setSectorTag] = useState(existing?.sectorTag ?? "");
  const [jobTitleKeyword, setJobTitleKeyword] = useState(
    existing?.jobTitleKeyword ?? "",
  );
  const [targetTitlesRaw, setTargetTitlesRaw] = useState(
    (existing?.targetTitles ?? []).join("\n"),
  );
  const [managerTitlesRaw, setManagerTitlesRaw] = useState(
    (existing?.managerTitles ?? []).join("\n"),
  );

  const createConfig = useCreateSpecSearchConfig();
  const updateConfig = useUpdateSpecSearchConfig();

  function handleClose() { onClose(); }

  function handleSave() {
    const payload = {
      sectorTag: sectorTag || null,
      jobTitleKeyword: jobTitleKeyword || null,
      targetTitles: targetTitlesRaw.split("\n").map((s) => s.trim()).filter(Boolean),
      managerTitles: managerTitlesRaw.split("\n").map((s) => s.trim()).filter(Boolean),
    };

    if (existing) {
      updateConfig.mutate(
        { id: existing.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Config updated" });
            qc.invalidateQueries({ queryKey: getListSpecSearchConfigsQueryKey() });
            onSaved(); handleClose();
          },
        },
      );
    } else {
      createConfig.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Config created" });
            qc.invalidateQueries({ queryKey: getListSpecSearchConfigsQueryKey() });
            onSaved(); handleClose();
          },
        },
      );
    }
  }

  const isPending = createConfig.isPending || updateConfig.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Search Config" : "New Search Config"}</DialogTitle>
          <DialogDescription>
            Define which Apollo title keywords to search per sector or job title.
            Leave both scope fields blank to create a tenant-level default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sector tag (optional)</Label>
              <Input
                value={sectorTag}
                onChange={(e) => setSectorTag(e.target.value)}
                placeholder="insurance"
                data-testid="input-config-sector"
              />
            </div>
            <div className="space-y-1">
              <Label>Job title keyword (optional)</Label>
              <Input
                value={jobTitleKeyword}
                onChange={(e) => setJobTitleKeyword(e.target.value)}
                placeholder="Actuary"
                data-testid="input-config-keyword"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Talent Acquisition titles (one per line)</Label>
            <Textarea
              value={targetTitlesRaw}
              onChange={(e) => setTargetTitlesRaw(e.target.value)}
              rows={4}
              placeholder={"Talent Acquisition Manager\nTalent Partner\nHead of Talent"}
              data-testid="input-config-ta-titles"
            />
          </div>
          <div className="space-y-1">
            <Label>Hiring Manager titles (one per line)</Label>
            <Textarea
              value={managerTitlesRaw}
              onChange={(e) => setManagerTitlesRaw(e.target.value)}
              rows={4}
              placeholder={"Head of Actuarial\nActuarial Director\nChief Actuary"}
              data-testid="input-config-manager-titles"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            data-testid="button-save-config"
          >
            {isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            {existing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Settings section
// ---------------------------------------------------------------------------
function SettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [configDialog, setConfigDialog] = useState<{
    open: boolean;
    existing: JobSpecSearchConfig | null;
  }>({ open: false, existing: null });

  const { data: configs = [], isLoading } = useListSpecSearchConfigs({
    query: { queryKey: getListSpecSearchConfigsQueryKey() },
  });
  const deleteConfig = useDeleteSpecSearchConfig();

  function handleDeleteConfig(id: string) {
    deleteConfig.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Config deleted" });
          qc.invalidateQueries({ queryKey: getListSpecSearchConfigsQueryKey() });
        },
      },
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Apollo Search Configs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure which Apollo title keywords to use per sector or job title keyword.
            When no config matches a job, built-in generic defaults are used.
          </p>
        </div>
        <Button
          onClick={() => setConfigDialog({ open: true, existing: null })}
          data-testid="button-new-config"
          size="sm"
        >
          <Plus size={14} className="mr-1.5" /> New Config
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : configs.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No custom configs — built-in defaults apply to all searches.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-4">Scope</th>
                <th className="text-left py-2 pr-4">TA Titles</th>
                <th className="text-left py-2 pr-4">Manager Titles</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <SearchConfigRow
                  key={c.id}
                  config={c}
                  onEdit={(cfg) => setConfigDialog({ open: true, existing: cfg })}
                  onDelete={handleDeleteConfig}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfigDialog
        open={configDialog.open}
        existing={configDialog.existing}
        onClose={() => setConfigDialog({ open: false, existing: null })}
        onSaved={() => setConfigDialog({ open: false, existing: null })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder content panel
// ---------------------------------------------------------------------------
function FolderPanel({
  folderId,
}: {
  folderId: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [contactDialog, setContactDialog] = useState<{
    open: boolean;
    initial: JobSpecContact | null;
    itemId: string | null;
  }>({ open: false, initial: null, itemId: null });
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useListSpecFolderItems(folderId, {
    query: { queryKey: getListSpecFolderItemsQueryKey(folderId) },
  });

  const removeItem = useRemoveSpecFolderItem();
  const enrichItem = useEnrichSpecFolderItem();
  const deleteContact = useDeleteSpecFolderContact();

  function handleRemove(itemId: string) {
    removeItem.mutate(
      { itemId },
      {
        onSuccess: () => {
          toast({ title: "Removed from folder" });
          qc.invalidateQueries({ queryKey: getListSpecFolderItemsQueryKey(folderId) });
          qc.invalidateQueries({ queryKey: getListSpecFoldersQueryKey() });
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      },
    );
  }

  function handleEnrich(itemId: string) {
    setEnrichingIds((prev) => new Set(prev).add(itemId));
    enrichItem.mutate(
      { itemId },
      {
        onSuccess: (contacts) => {
          toast({
            title: "Contacts refreshed",
            description: `Found ${contacts.length} contacts via Apollo.`,
          });
          qc.invalidateQueries({ queryKey: getListSpecFolderItemsQueryKey(folderId) });
          setEnrichingIds((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Enrichment failed";
          toast({ title: "Error", description: msg, variant: "destructive" });
          setEnrichingIds((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
        },
      },
    );
  }

  function handleDeleteContact(contactId: string) {
    deleteContact.mutate(
      { contactId },
      {
        onSuccess: () => {
          toast({ title: "Contact deleted" });
          qc.invalidateQueries({ queryKey: getListSpecFolderItemsQueryKey(folderId) });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-10 text-center">
        <ClipboardList size={28} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No jobs in this folder yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use the <strong>Send to Spec List</strong> action from Job Search or Matches to add vacancies here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0">
        {items.map((item) =>
          enrichingIds.has(item.id) ? (
            <Card key={item.id} className="mb-3">
              <CardContent className="pt-4 pb-3 flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                Re-running Apollo search for <strong>{item.job.title}</strong>…
              </CardContent>
            </Card>
          ) : (
            <FolderItemCard
              key={item.id}
              item={item}
              onRemove={handleRemove}
              onEnrich={handleEnrich}
              onAddContact={(itemId) =>
                setContactDialog({ open: true, initial: null, itemId })
              }
              onEditContact={(c) =>
                setContactDialog({ open: true, initial: c, itemId: null })
              }
              onDeleteContact={handleDeleteContact}
            />
          ),
        )}
      </div>
      <ContactDialog
        open={contactDialog.open}
        initial={contactDialog.initial}
        itemId={contactDialog.itemId}
        onClose={() => setContactDialog({ open: false, initial: null, itemId: null })}
        onSaved={() =>
          qc.invalidateQueries({ queryKey: getListSpecFolderItemsQueryKey(folderId) })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SpecListPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"team" | "personal" | "settings">("team");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState<{
    open: boolean;
    existing: JobSpecFolder | null;
  }>({ open: false, existing: null });
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  const { data: folders = [], isLoading: foldersLoading } = useListSpecFolders({
    query: { queryKey: getListSpecFoldersQueryKey() },
  });

  const deleteFolder = useDeleteSpecFolder();

  // Auto-select first folder when list loads or tab changes
  const tabFolders = folders.filter((f) =>
    activeTab === "team" ? f.visibility === "team" : f.visibility === "personal",
  );
  const effectiveFolderId =
    selectedFolderId && tabFolders.some((f) => f.id === selectedFolderId)
      ? selectedFolderId
      : (tabFolders[0]?.id ?? null);

  function handleDeleteFolder(id: string) {
    setDeletingFolderId(id);
    deleteFolder.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Folder deleted" });
          qc.invalidateQueries({ queryKey: getListSpecFoldersQueryKey() });
          if (selectedFolderId === id) setSelectedFolderId(null);
          setDeletingFolderId(null);
        },
        onError: () => {
          toast({ title: "Error deleting folder", variant: "destructive" });
          setDeletingFolderId(null);
        },
      },
    );
  }

  const selectedFolder = folders.find((f) => f.id === effectiveFolderId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList size={22} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Spec List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build targeted vacancy lists with auto-enriched contacts from Apollo.io
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      >
        <TabsList className="mb-5">
          <TabsTrigger value="team" data-testid="tab-team-lists">
            <Users size={14} className="mr-1.5" /> Team Lists
          </TabsTrigger>
          <TabsTrigger value="personal" data-testid="tab-my-lists">
            <Folder size={14} className="mr-1.5" /> My Lists
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings size={14} className="mr-1.5" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Team / personal list tabs */}
        {(["team", "personal"] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="flex gap-6">
              {/* Folder sidebar */}
              <FolderSidebar
                folders={folders}
                selectedId={effectiveFolderId}
                onSelect={setSelectedFolderId}
                onNew={() =>
                  setFolderDialog({ open: true, existing: null })
                }
                loading={foldersLoading}
                tab={tab}
              />

              {/* Main panel */}
              <div className="flex-1 min-w-0">
                {effectiveFolderId && selectedFolder ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FolderOpen size={18} className="text-muted-foreground" />
                        <h2 className="font-semibold">{selectedFolder.name}</h2>
                        <span className="text-xs text-muted-foreground">
                          {selectedFolder.itemCount} job{selectedFolder.itemCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() =>
                            setFolderDialog({ open: true, existing: selectedFolder })
                          }
                          data-testid="button-rename-folder"
                        >
                          <Pencil size={12} className="mr-1" /> Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFolder(selectedFolder.id)}
                          disabled={deletingFolderId === selectedFolder.id}
                          data-testid="button-delete-folder"
                        >
                          {deletingFolderId === selectedFolder.id ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : (
                            <Trash2 size={12} className="mr-1" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                    <FolderPanel folderId={effectiveFolderId} />
                  </>
                ) : (
                  <div className="border border-dashed border-border rounded-lg p-10 text-center">
                    <Folder size={28} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select or create a folder to get started.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        ))}

        {/* Settings tab */}
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>

      {/* Folder dialog */}
      <FolderDialog
        open={folderDialog.open}
        existing={folderDialog.existing}
        defaultVisibility={activeTab === "personal" ? "personal" : "team"}
        onClose={() => setFolderDialog({ open: false, existing: null })}
        onSaved={() => setFolderDialog({ open: false, existing: null })}
      />
    </div>
  );
}
