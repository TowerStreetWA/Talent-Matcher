import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Check, UserPlus, XCircle } from "lucide-react";
import {
  useListTeamMembers,
  useUpdateTeamMember,
  useListInvites,
  useCreateInvite,
  useRevokeInvite,
  getListTeamMembersQueryKey,
  getListInvitesQueryKey,
  type ApiMessage,
  type CreateInviteInputRole,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INVITE_ROLES: CreateInviteInputRole[] = ["admin", "recruiter", "viewer"];

export default function Team() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CreateInviteInputRole>("recruiter");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const members = useListTeamMembers({
    query: { queryKey: getListTeamMembersQueryKey() },
  });
  const invites = useListInvites({
    query: { queryKey: getListInvitesQueryKey() },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
  };

  const onApiError = (err: unknown, fallback: string) => {
    toast({
      title: "Error",
      description: (err as ApiMessage | undefined)?.message ?? fallback,
      variant: "destructive",
    });
  };

  const createInvite = useCreateInvite({
    mutation: {
      onSuccess: (data) => {
        setInviteEmail("");
        setLastInviteUrl(data.inviteUrl);
        setCopied(false);
        refresh();
        toast({
          title: "Invite created",
          description: data.emailSent
            ? `Invitation emailed to ${data.invite.email}.`
            : `Email could not be delivered — share the invite link below with ${data.invite.email}.`,
        });
      },
      onError: (err) => onApiError(err, "Could not create the invite"),
    },
  });

  const updateMember = useUpdateTeamMember({
    mutation: {
      onSuccess: refresh,
      onError: (err) => onApiError(err, "Could not update the member"),
    },
  });

  const revokeInvite = useRevokeInvite({
    mutation: {
      onSuccess: refresh,
      onError: (err) => onApiError(err, "Could not revoke the invite"),
    },
  });

  const copyInviteUrl = async () => {
    if (!lastInviteUrl) return;
    await navigator.clipboard.writeText(lastInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    createInvite.mutate({
      data: { email: inviteEmail.trim(), role: inviteRole },
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage members and invitations for {user?.tenantName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus size={18} /> Invite a teammate
          </CardTitle>
          <CardDescription>
            They'll get an email with a link to join. You can also copy the
            link and share it directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submitInvite} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2 flex-1 min-w-[220px]">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="teammate@agency.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2 w-40">
              <Label>Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as CreateInviteInputRole)}
              >
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={createInvite.isPending || !inviteEmail.trim()}
              data-testid="button-send-invite"
            >
              {createInvite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </form>
          {lastInviteUrl && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
              <code className="text-xs flex-1 truncate" data-testid="text-invite-url">
                {lastInviteUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyInviteUrl()}
                data-testid="button-copy-invite-url"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {(invites.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.data?.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
                data-testid={`row-invite-${invite.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.role} · invited by {invite.invitedByName} · expires{" "}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revokeInvite.mutate({ inviteId: invite.id })}
                  disabled={revokeInvite.isPending}
                  data-testid={`button-revoke-${invite.id}`}
                >
                  <XCircle size={14} /> Revoke
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Owners cannot be modified. You cannot change your own role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.isLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {members.data?.map((member) => {
            const locked = member.role === "owner" || member.id === user?.id;
            return (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                data-testid={`row-member-${member.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.fullName}
                    {member.id === user?.id && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {member.status !== "active" && (
                    <Badge variant="secondary">disabled</Badge>
                  )}
                  {locked ? (
                    <Badge variant="outline">{member.role}</Badge>
                  ) : (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateMember.mutate({
                            userId: member.id,
                            data: { role: role as CreateInviteInputRole },
                          })
                        }
                      >
                        <SelectTrigger
                          className="w-32"
                          data-testid={`select-role-${member.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INVITE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateMember.mutate({
                            userId: member.id,
                            data: {
                              status:
                                member.status === "active" ? "disabled" : "active",
                            },
                          })
                        }
                        disabled={updateMember.isPending}
                        data-testid={`button-toggle-status-${member.id}`}
                      >
                        {member.status === "active" ? "Disable" : "Enable"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
