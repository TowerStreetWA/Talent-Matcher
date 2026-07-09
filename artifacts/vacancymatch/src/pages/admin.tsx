import React from "react";
import { useListAuditLogs, useListCrmSyncEvents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, ArrowRightLeft, User, Database } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  const { data: auditLogs, isLoading: loadingLogs } = useListAuditLogs();
  const { data: syncEvents, isLoading: loadingSyncs } = useListCrmSyncEvents();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Compliance & Admin</h1>
        <p className="text-muted-foreground mt-1">Audit logs, integration events, and compliance overview.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-primary" /> GDPR & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground leading-relaxed">
            <p>VacancyMatch acts as a data processor. All candidate CVs are stored securely and parsed temporarily for matching.</p>
            <p>Matching algorithms are deterministic and explainable. No fully automated decision making occurs without human oversight (Human-in-the-Loop).</p>
            <p>System maintains immutable audit trails of all shortlisting, dismissals, and data transfers to external CRMs.</p>
          </CardContent>
        </Card>

        <Card className="bg-secondary/30 border-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="w-5 h-5" /> Data Retention
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground leading-relaxed">
            <ul className="list-disc list-inside pl-2 space-y-1">
              <li>Candidate Profiles: Retained while active, deleted upon request.</li>
              <li>Live Jobs: Synced daily, expired jobs removed after 30 days.</li>
              <li>Match History: Retained for 12 months for compliance auditing.</li>
              <li>Audit Logs: Immutable, retained permanently.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="audit" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="audit">System Audit Logs</TabsTrigger>
          <TabsTrigger value="crm">CRM Sync Events</TabsTrigger>
        </TabsList>
        
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Immutable record of critical system actions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLogs ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : auditLogs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No audit logs available.</TableCell>
                    </TableRow>
                  ) : (
                    auditLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <User className="w-3 h-3 text-muted-foreground" /> {log.actorName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs font-normal bg-accent/30">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {log.entityType} <span className="opacity-50">[{log.entityId?.slice(0,8)}]</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="crm" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>CRM Sync Events</CardTitle>
              <CardDescription>Status of candidate data pushed to external CRMs.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Time</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSyncs ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : syncEvents?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No sync events available.</TableCell>
                    </TableRow>
                  ) : (
                    syncEvents?.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(event.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                            <ArrowRightLeft className="w-3 h-3 mr-1" /> {event.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {event.crmName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.candidateName} <span className="text-muted-foreground mx-1">→</span> {event.jobTitle}
                        </TableCell>
                        <TableCell>
                          <Badge variant={event.status === 'success' ? 'default' : event.status === 'failed' ? 'destructive' : 'secondary'}>
                            {event.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
