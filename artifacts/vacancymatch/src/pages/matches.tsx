import React, { useState } from "react";
import { useListMatches } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export default function Matches() {
  const [recruiterStatus, setRecruiterStatus] = useState<string>("all");
  const [minScore, setMinScore] = useState<number[]>([70]);

  const { data: matches, isLoading } = useListMatches({
    recruiterStatus: recruiterStatus === "all" ? undefined : recruiterStatus,
    minScore: minScore[0]
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global Matches</h1>
        <p className="text-muted-foreground mt-1">Review all active matches across your pipeline.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center bg-card p-4 border rounded-xl shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mr-4">
          <Filter className="w-4 h-4" /> Filters
        </div>
        
        <div className="w-full sm:w-48">
          <Select value={recruiterStatus} onValueChange={setRecruiterStatus}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="shortlisted">Shortlisted</SelectItem>
              <SelectItem value="pushed">Pushed to CRM</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-64 flex items-center gap-4">
          <span className="text-sm font-medium whitespace-nowrap">Min Score: {minScore[0]}</span>
          <Slider 
            value={minScore} 
            onValueChange={setMinScore} 
            max={100} 
            step={5} 
            className="w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : matches?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
          <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">No matches found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
            Try lowering your minimum score or changing the status filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches?.map((match) => (
            <Card key={match.id} className="flex flex-col hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-base line-clamp-1" title={match.job?.title}>{match.job?.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{match.job?.companyName} • {match.job?.locationText}</p>
                  </div>
                  <Badge variant={
                    match.overallScore >= 90 ? "default" : 
                    match.overallScore >= 80 ? "secondary" : "outline"
                  } className="text-sm px-2 py-0.5 shrink-0">
                    {match.overallScore}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4 bg-muted/50 p-2 rounded-md">
                  <span className="text-sm font-medium">Candidate:</span>
                  <Link href={`/candidates/${match.candidateId}`} className="text-sm text-primary hover:underline font-medium">
                    {match.candidateName || "Unknown"}
                  </Link>
                </div>
                
                <div className="space-y-2 mb-4 flex-1">
                  <p className="text-sm line-clamp-3 text-muted-foreground">{match.explanation[0]}</p>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t">
                  <Badge variant="outline" className="capitalize text-xs font-normal">
                    {match.recruiterStatus}
                  </Badge>
                  <Link href={`/candidates/${match.candidateId}`}>
                    <Button variant="secondary" size="sm">View Details</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
