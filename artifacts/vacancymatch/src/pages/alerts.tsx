import React, { useState } from "react";
import { 
  useListAlertRules, 
  useUpdateAlertRule, 
  useDeleteAlertRule,
  getListAlertRulesQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Trash2, Clock, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function Alerts() {
  const { data: alerts, isLoading } = useListAlertRules();
  const updateAlert = useUpdateAlertRule();
  const deleteAlert = useDeleteAlertRule();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggle = (id: string, currentStatus: boolean) => {
    updateAlert.mutate({
      id,
      data: { isActive: !currentStatus }
    }, {
      onSuccess: () => {
        toast({ title: "Alert updated", description: "Alert status has been changed." });
        queryClient.invalidateQueries({ queryKey: getListAlertRulesQueryKey() });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;
    
    deleteAlert.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Alert deleted", description: "The alert rule has been removed." });
        queryClient.invalidateQueries({ queryKey: getListAlertRulesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Alert Rules</h1>
          <p className="text-muted-foreground mt-1">Manage automated matching notifications.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-6 w-10 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : alerts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No alerts configured</h3>
            <p className="text-sm text-muted-foreground mt-1">Go to a candidate profile to set up match alerts.</p>
          </div>
        ) : (
          alerts?.map((alert) => (
            <Card key={alert.id} className={!alert.isActive ? "opacity-60 bg-muted/30" : ""}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">
                        <Link href={`/candidates/${alert.candidateId}`} className="hover:underline text-primary">
                          {alert.candidateName || "Candidate"}
                        </Link>
                      </h3>
                      <div className="flex items-center text-xs font-medium bg-muted px-2 py-1 rounded-md text-muted-foreground">
                        <Target className="w-3 h-3 mr-1" /> &ge; {alert.minScore} Score
                      </div>
                      <div className="flex items-center text-xs font-medium bg-muted px-2 py-1 rounded-md text-muted-foreground capitalize">
                        <Clock className="w-3 h-3 mr-1" /> {alert.frequency}
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground flex gap-4 pt-2">
                      <span>Last checked: {alert.lastCheckedAt ? formatDistanceToNow(new Date(alert.lastCheckedAt), { addSuffix: true }) : 'Never'}</span>
                      <span>Last triggered: {alert.lastTriggeredAt ? formatDistanceToNow(new Date(alert.lastTriggeredAt), { addSuffix: true }) : 'Never'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Switch 
                      checked={alert.isActive} 
                      onCheckedChange={() => handleToggle(alert.id, alert.isActive)} 
                    />
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(alert.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
