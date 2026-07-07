import React, { useState } from "react";
import { 
  useListJobSources, 
  useCreateJobSource, 
  useUpdateJobSource,
  getListJobSourcesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Database, Plus, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { Label } from "@/components/ui/label";

export default function Sources() {
  const { data: sources, isLoading } = useListJobSources();
  const updateSource = useUpdateJobSource();
  const createSource = useCreateJobSource();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", sourceType: "api", baseUrl: "" });

  const handleToggle = (id: string, currentStatus: boolean) => {
    updateSource.mutate({
      id,
      data: { isActive: !currentStatus }
    }, {
      onSuccess: () => {
        toast({ title: "Source updated", description: `Source has been ${!currentStatus ? 'enabled' : 'disabled'}.` });
        queryClient.invalidateQueries({ queryKey: getListJobSourcesQueryKey() });
      }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.name || !newSource.sourceType) return;
    
    createSource.mutate({
      data: newSource
    }, {
      onSuccess: () => {
        toast({ title: "Source added", description: `${newSource.name} has been added successfully.` });
        setIsDialogOpen(false);
        setNewSource({ name: "", sourceType: "api", baseUrl: "" });
        queryClient.invalidateQueries({ queryKey: getListJobSourcesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Sources</h1>
          <p className="text-muted-foreground mt-1">Manage integration health and sync status.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Job Source</DialogTitle>
              <DialogDescription>Configure a new API or scraping source for live jobs.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Source Name</Label>
                <Input 
                  id="name" 
                  value={newSource.name} 
                  onChange={e => setNewSource({...newSource, name: e.target.value})} 
                  placeholder="e.g. LinkedIn, Indeed, Custom API"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Source Type</Label>
                <Input 
                  id="type" 
                  value={newSource.sourceType} 
                  onChange={e => setNewSource({...newSource, sourceType: e.target.value})} 
                  placeholder="api, scraper, webhook..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Base URL (Optional)</Label>
                <Input 
                  id="url" 
                  value={newSource.baseUrl} 
                  onChange={e => setNewSource({...newSource, baseUrl: e.target.value})} 
                  placeholder="https://api.example.com/jobs"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createSource.isPending}>
                  {createSource.isPending ? "Adding..." : "Add Source"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : sources?.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
            <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No job sources</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Add a source to start importing jobs.</p>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>Add your first source</Button>
          </div>
        ) : (
          sources?.map((source) => (
            <Card key={source.id} className={!source.isActive ? "opacity-75 bg-muted/30" : ""}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {source.name}
                      {source.healthStatus === 'healthy' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : source.healthStatus === 'error' ? (
                        <XCircle className="w-4 h-4 text-destructive" />
                      ) : null}
                    </CardTitle>
                    <CardDescription className="uppercase text-[10px] tracking-wider font-semibold mt-1">
                      {source.sourceType}
                    </CardDescription>
                  </div>
                  <Switch 
                    checked={source.isActive} 
                    onCheckedChange={() => handleToggle(source.id, source.isActive)} 
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase">Active Jobs</p>
                    <p className="text-2xl font-semibold">{source.jobCount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase">Last Sync</p>
                    <p className="text-sm flex items-center gap-1 mt-1">
                      <RefreshCw className="w-3 h-3 text-muted-foreground" />
                      {source.lastSyncAt ? formatDistanceToNow(new Date(source.lastSyncAt), { addSuffix: true }) : 'Never'}
                    </p>
                  </div>
                </div>
                {source.baseUrl && (
                  <div className="mt-4 pt-4 border-t text-xs font-mono text-muted-foreground truncate">
                    {source.baseUrl}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
