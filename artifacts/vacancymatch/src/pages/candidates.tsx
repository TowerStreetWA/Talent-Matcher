import React, { useEffect, useState } from "react";
import { useListCandidates } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, FileText, ChevronRight, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchBox } from "@/components/search-box";
import { useDebounce } from "@/hooks/use-debounce";
import { track } from "@/lib/analytics";

export default function Candidates() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const debouncedSearch = useDebounce(search, 300);

  const { data: candidates, isLoading } = useListCandidates({
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    ...(status !== "all" ? { status } : {}),
  });

  useEffect(() => {
    if (!debouncedSearch.trim() || isLoading || !candidates) return;
    track("search_performed", {
      scope: "candidates",
      query: debouncedSearch.trim(),
      resultCount: candidates.length,
      statusFilter: status,
    });
    if (candidates.length === 0) {
      track("search_zero_results", {
        scope: "candidates",
        query: debouncedSearch.trim(),
        statusFilter: status,
      });
    }
  }, [debouncedSearch, candidates, isLoading, status]);

  const hasActiveFilters = Boolean(debouncedSearch.trim()) || status !== "all";
  const clearAll = (): void => {
    setSearch("");
    setStatus("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Candidates</h1>
          <p className="text-muted-foreground mt-1">Manage and match candidates across live jobs.</p>
        </div>
        <Link href="/upload">
          <Button>
            <UserPlus className="mr-2 h-4 w-4" /> Add Candidate
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <SearchBox
                scope="candidates"
                value={search}
                onChange={setSearch}
                placeholder='Try "swe", "frontend dev", a name, skill, or company...'
                containerClassName="flex-1"
                inputClassName="border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto py-1"
              />
            </div>
            <div className="w-full sm:w-40">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {debouncedSearch.trim() && (
              <Badge variant="secondary" className="gap-1 font-normal">
                Search: “{debouncedSearch.trim()}”
                <button
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {status !== "all" && (
              <Badge variant="secondary" className="gap-1 font-normal capitalize">
                Status: {status}
                <button
                  aria-label="Clear status filter"
                  onClick={() => setStatus("all")}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
                Clear all
              </Button>
            )}
            {!isLoading && candidates && (
              <span className="text-muted-foreground ml-auto">
                {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Candidate</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : candidates?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="h-8 w-8 mb-4 text-muted-foreground/50" />
                      <p className="font-medium text-foreground">No candidates found</p>
                      {hasActiveFilters ? (
                        <>
                          <p className="text-sm mt-1">
                            {debouncedSearch.trim() && status !== "all"
                              ? "Your search and status filter may be too restrictive."
                              : debouncedSearch.trim()
                                ? `Nothing matched “${debouncedSearch.trim()}”. Try a broader term or a known synonym.`
                                : `No candidates with status “${status}”.`}
                          </p>
                          <div className="flex gap-2 mt-4">
                            {debouncedSearch.trim() && (
                              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                                Clear search
                              </Button>
                            )}
                            {status !== "all" && (
                              <Button variant="outline" size="sm" onClick={() => setStatus("all")}>
                                Show all statuses
                              </Button>
                            )}
                            <Button variant="secondary" size="sm" onClick={clearAll}>
                              Clear all filters
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm mt-1">Upload a CV to add your first candidate.</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                candidates?.map((candidate) => (
                  <TableRow key={candidate.id} className="group cursor-pointer">
                    <TableCell className="font-medium">
                      {candidate.firstName} {candidate.lastName}
                    </TableCell>
                    <TableCell>{candidate.currentTitle || "N/A"}</TableCell>
                    <TableCell>{candidate.locationText || "N/A"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {candidate.skills.slice(0, 3).map((skill, i) => (
                          <Badge variant="secondary" key={i} className="text-xs px-1.5 py-0 rounded-sm font-normal">
                            {skill}
                          </Badge>
                        ))}
                        {candidate.skills.length > 3 && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 rounded-sm font-normal text-muted-foreground">
                            +{candidate.skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={candidate.status === 'active' ? "default" : "secondary"}>
                        {candidate.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/candidates/${candidate.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="group-hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (debouncedSearch.trim()) {
                              track("search_result_clicked", {
                                scope: "candidates",
                                query: debouncedSearch.trim(),
                                resultId: candidate.id,
                              });
                            }
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
