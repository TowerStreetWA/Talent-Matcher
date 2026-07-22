import { useState } from "react";
import { useGetUsageReport } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ArrowRightLeft, TrendingUp, Users, RefreshCw } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString();
}

function roleColor(role: string) {
  if (role === "owner") return "default";
  if (role === "admin") return "secondary";
  return "outline";
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function UsageReport() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);

  const { data, isLoading, isError, refetch } = useGetUsageReport({
    from: appliedFrom,
    to: appliedTo,
  });

  function apply() {
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  const agg = data?.aggregate;
  const users = data?.byUser ?? [];
  const period = data?.period;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track searches, results, and Bullhorn forwards per user during the pilot.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isLoading}>
          <RefreshCw size={14} className={`mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="from-date">From</Label>
              <Input
                id="from-date"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to-date">To</Label>
              <Input
                id="to-date"
                type="date"
                value={to}
                min={from}
                max={defaultTo()}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={apply} disabled={isLoading}>Apply</Button>
            {period && (
              <span className="text-xs text-muted-foreground self-center">
                Showing {period.from} → {period.to}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card>
          <CardContent className="pt-4 text-destructive text-sm">
            Failed to load usage data. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Search size={13} /> Total Searches
            </div>
            <div className="text-3xl font-bold">{isLoading ? "—" : fmt(agg?.searches ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp size={13} /> Results Returned
            </div>
            <div className="text-3xl font-bold">{isLoading ? "—" : fmt(agg?.resultsReturned ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              avg {isLoading ? "—" : (agg?.avgResultsPerSearch ?? 0)} per search
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ArrowRightLeft size={13} /> Bullhorn Forwards
            </div>
            <div className="text-3xl font-bold">{isLoading ? "—" : fmt(agg?.crmPushes ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users size={13} /> Zero-Result Searches
            </div>
            <div className="text-3xl font-bold">{isLoading ? "—" : fmt(agg?.zeroResultSearches ?? 0)}</div>
            {(agg?.searches ?? 0) > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(((agg?.zeroResultSearches ?? 0) / (agg?.searches ?? 1)) * 100)}% of searches
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-user breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>By User</CardTitle>
          <CardDescription>
            Activity per team member during the selected period. Sorted by search count.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Searches</TableHead>
                  <TableHead className="text-right">Results returned</TableHead>
                  <TableHead className="text-right">Avg results / search</TableHead>
                  <TableHead className="text-right">Zero-result</TableHead>
                  <TableHead className="text-right">Bullhorn forwards</TableHead>
                  <TableHead>Last search</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No team members found.
                    </TableCell>
                  </TableRow>
                )}
                {[...users]
                  .sort((a, b) => b.searches - a.searches)
                  .map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell>
                        <div className="font-medium">{u.userName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleColor(u.role)} className="capitalize text-xs">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(u.searches)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(u.resultsReturned)}</TableCell>
                      <TableCell className="text-right font-mono">{u.avgResultsPerSearch}</TableCell>
                      <TableCell className="text-right font-mono">
                        {u.zeroResultSearches > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">{fmt(u.zeroResultSearches)}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(u.crmPushes)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.lastSearchAt
                          ? new Date(u.lastSearchAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : <span className="text-muted-foreground/50">No searches</span>}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Searches are counted once per executed query (pagination does not inflate counts).
        Bullhorn forwards are matched from the audit log by user name.
      </p>
    </div>
  );
}
