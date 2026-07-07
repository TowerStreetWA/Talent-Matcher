import React, { useState } from "react";
import { useListJobs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Briefcase, MapPin, Building, ExternalLink, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export default function Jobs() {
  const [search, setSearch] = useState("");
  const { data: jobs, isLoading } = useListJobs({ search });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Jobs Market</h1>
          <p className="text-muted-foreground mt-1">Search active vacancies across connected sources.</p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search jobs by title, company, or skills..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11 bg-card shadow-sm"
        />
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : jobs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
            <Briefcase className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No jobs found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search criteria.</p>
          </div>
        ) : (
          jobs?.map((job) => (
            <Card key={job.id} className="overflow-hidden hover:border-primary/40 transition-colors">
              <CardContent className="p-0">
                <div className="p-6 flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
                          {job.sourceName || "Direct"}
                        </Badge>
                        {job.postedAt && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold leading-tight mb-1">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          {job.companyName || "Unknown Company"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {job.locationText || "Remote"} {job.remoteType ? `(${job.remoteType})` : ""}
                        </div>
                        {job.salaryMin && job.salaryMax && (
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            {job.salaryCurrency}{job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {job.skills.slice(0, 8).map((skill, i) => (
                        <Badge key={i} variant="secondary" className="font-normal text-xs px-2 rounded-sm bg-accent/50 text-accent-foreground border-accent-border/50">
                          {skill}
                        </Badge>
                      ))}
                      {job.skills.length > 8 && (
                        <Badge variant="outline" className="font-normal text-xs px-2 rounded-sm">
                          +{job.skills.length - 8}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex md:flex-col items-center justify-between md:justify-start gap-4 md:border-l md:pl-6">
                    <Badge variant={job.status === "active" ? "default" : "secondary"}>
                      {job.status}
                    </Badge>
                    {job.applyUrl && (
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                          Apply <ExternalLink className="ml-2 w-3 h-3" />
                        </a>
                      </Button>
                    )}
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
