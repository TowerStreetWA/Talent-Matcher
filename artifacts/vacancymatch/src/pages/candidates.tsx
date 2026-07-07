import React, { useState } from "react";
import { useListCandidates } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, FileText, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Candidates() {
  const [search, setSearch] = useState("");
  const { data: candidates, isLoading } = useListCandidates({ search });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
          <p className="text-muted-foreground mt-1">Manage and match candidates across live jobs.</p>
        </div>
        <Link href="/upload">
          <Button>
            <UserPlus className="mr-2 h-4 w-4" /> Add Candidate
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-2 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search candidates by name, skills, or title..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto py-1"
            />
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
                      <p>No candidates found.</p>
                      {search && <p className="text-sm mt-1">Try adjusting your search filters.</p>}
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
                        <Button variant="ghost" size="icon" className="group-hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
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
