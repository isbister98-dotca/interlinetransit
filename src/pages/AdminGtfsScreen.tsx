import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, RefreshCw, Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Clock, XCircle, StopCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SYNC_FUNCTIONS = [
  "gtfs-sync-agency",
  "gtfs-sync-calendar",
  "gtfs-sync-routes",
  "gtfs-sync-stops",
  "gtfs-sync-trips",
  "gtfs-sync-shapes",
  "gtfs-sync-transfers",
];

const DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6];
const HOURS = Array.from({ length: 28 }, (_, i) => i); // 0-27

interface Feed {
  id: string;
  agency_id: string;
  feed_url: string;
  is_active: boolean;
  last_synced: string | null;
  created_at: string;
}

interface SyncStatus {
  id: string;
  agency_id: string;
  file_type: string;
  status: string;
  row_count: number;
  error_msg: string | null;
  started_at: string | null;
  completed_at: string | null;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

function isStaleRunning(status: string, startedAt: string | null): boolean {
  if (status !== "running" || !startedAt) return false;
  return Date.now() - new Date(startedAt).getTime() > STALE_THRESHOLD_MS;
}

function StatusBadge({ status, startedAt }: { status: string; startedAt?: string | null }) {
  if (isStaleRunning(status, startedAt ?? null)) {
    return (
      <Badge className="bg-warning/20 text-warning border-warning/30 flex items-center gap-1 w-fit">
        <AlertTriangle className="h-3 w-3" /> Stale
      </Badge>
    );
  }
  switch (status) {
    case "done":
      return <Badge className="bg-success/20 text-success border-success/30">Done</Badge>;
    case "running":
      return <Badge className="bg-info/20 text-info border-info/30">Running</Badge>;
    case "error":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Error</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

/** Parse hour statuses from file_type like stop_times_d0_h6 */
function parseHourFileType(ft: string): { day: number; hour: number } | null {
  const m = ft.match(/^stop_times_d(\d+)_h(\d+)$/);
  if (!m) return null;
  return { day: parseInt(m[1]), hour: parseInt(m[2]) };
}


function StopTimesGroup({
  statuses,
  agencyId,
  onRetriggerDay,
  retriggeringDays,
  onSyncAllDays,
  syncingAllDays,
  onRetriggerHour,
  retriggeringHours,
}: {
  statuses: SyncStatus[];
  agencyId: string;
  onRetriggerDay: (agencyId: string, dayOffset: number) => void;
  retriggeringDays: Set<string>;
  onSyncAllDays: (agencyId: string) => void;
  syncingAllDays: boolean;
  onRetriggerHour: (agencyId: string, dayOffset: number, hour: number) => void;
  retriggeringHours: Set<string>;
}) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [mainExpanded, setMainExpanded] = useState(false);

  const cleanupStatus = statuses.find(s => s.file_type === "stop_times_cleanup") ?? null;

  // Build day -> hour status map
  const dayHourMap: Record<number, (SyncStatus | null)[]> = {};
  for (const d of DAY_OFFSETS) {
    dayHourMap[d] = HOURS.map(h => statuses.find(s => s.file_type === `stop_times_d${d}_h${h}`) ?? null);
  }

  // Compute per-day aggregates from hour statuses
  const dayAggregates = DAY_OFFSETS.map(d => {
    const hourEntries = dayHourMap[d].filter(Boolean) as SyncStatus[];
    if (hourEntries.length === 0) return { status: "pending", rows: 0, doneCount: 0, started_at: null };

    const hasStale = hourEntries.some(s => isStaleRunning(s.status, s.started_at));
    const hasError = hourEntries.some(s => s.status === "error");
    const hasRunning = hourEntries.some(s => s.status === "running" && !isStaleRunning(s.status, s.started_at));
    const doneCount = hourEntries.filter(s => s.status === "done").length;
    const allDone = doneCount === 28;
    const rows = hourEntries.reduce((a, s) => a + (s.row_count || 0), 0);
    const status = hasStale ? "stale" : hasError ? "error" : hasRunning ? "running" : allDone ? "done" : "pending";
    return { status, rows, doneCount, started_at: hourEntries.find(s => s.started_at)?.started_at ?? null };
  });

  const allStatuses = [...dayAggregates.map(d => d.status), cleanupStatus?.status].filter(Boolean) as string[];
  const overallStatus = allStatuses.some(s => s === "stale") ? "stale"
    : allStatuses.some(s => s === "error") ? "error"
    : allStatuses.some(s => s === "running") ? "running"
    : allStatuses.every(s => s === "done") && allStatuses.length > 0 ? "done"
    : "pending";

  const totalRows = dayAggregates.reduce((a, d) => a + d.rows, 0);
  const dayLabels = ["Today", "Tomorrow", "+2d", "+3d", "+4d", "+5d", "+6d"];

  const toggleDay = (d: number) => {
    setExpandedDays(prev => {
      const n = new Set(prev);
      n.has(d) ? n.delete(d) : n.add(d);
      return n;
    });
  };

  return (
    <>
      <tr
        className="border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setMainExpanded(e => !e)}
      >
        <td className="p-3 text-foreground font-medium">{agencyId}</td>
        <td className="p-3 font-mono text-xs text-foreground flex items-center gap-1">
          {mainExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          stop_times (7d × 28h)
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            {overallStatus === "stale" ? (
              <Badge className="bg-warning/20 text-warning border-warning/30 flex items-center gap-1 w-fit">
                <AlertTriangle className="h-3 w-3" /> Stale
              </Badge>
            ) : (
              <StatusBadge status={overallStatus} />
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => { e.stopPropagation(); onSyncAllDays(agencyId); }}
              disabled={syncingAllDays}
            >
              {syncingAllDays ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sync All
            </Button>
          </div>
        </td>
        <td className="p-3 text-right text-foreground tabular-nums">{totalRows.toLocaleString()}</td>
        <td className="p-3 text-muted-foreground text-xs">—</td>
      </tr>

      {mainExpanded && DAY_OFFSETS.map(d => {
        const agg = dayAggregates[d];
        const dayExpanded = expandedDays.has(d);
        const retriggering = retriggeringDays.has(`${agencyId}-d${d}`);

        return (
          <React.Fragment key={`day-${d}`}>
            <tr
              className={`border-b border-border/50 cursor-pointer hover:bg-muted/20 ${agg.status === "stale" || agg.status === "error" ? "bg-warning/5" : "bg-muted/10"}`}
              onClick={() => toggleDay(d)}
            >
              <td className="p-2 pl-6 text-muted-foreground text-xs"></td>
              <td className="p-2 font-mono text-xs text-muted-foreground flex items-center gap-1">
                {dayExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className={d === 0 ? "text-primary font-semibold" : ""}>
                  {dayLabels[d]} (d{d})
                </span>
              </td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={agg.status === "stale" ? "running" : agg.status} startedAt={agg.status === "stale" ? agg.started_at : undefined} />
                  {(agg.status === "stale" || agg.status === "error" || agg.status === "pending") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); onRetriggerDay(agencyId, d); }}
                      disabled={retriggering}
                    >
                      {retriggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </td>
              <td className="p-2 text-right text-muted-foreground text-xs tabular-nums">
                {agg.rows > 0 ? agg.rows.toLocaleString() : "—"}
              </td>
              <td className="p-2 text-muted-foreground text-xs">
                {`${agg.doneCount}/28 hours`}
              </td>
            </tr>

            {dayExpanded && HOURS.map(h => {
              const s = dayHourMap[d][h];
              const effectiveStatus = s
                ? isStaleRunning(s.status, s.started_at) ? "stale" : s.status
                : "pending";
              const isActionable = effectiveStatus === "error" || effectiveStatus === "stale" || effectiveStatus === "pending";
              const dimmed = effectiveStatus === "done" && (s?.row_count || 0) === 0;

              return (
                <tr key={`h-${d}-${h}`} className={`border-b border-border/30 ${dimmed ? "opacity-40" : ""} bg-muted/5`}>
                  <td className="p-1 pl-10 text-muted-foreground text-xs"></td>
                  <td className="p-1 font-mono text-xs text-muted-foreground pl-4">h{h}</td>
                  <td className="p-1">
                    <div className="flex items-center gap-1">
                      <StatusBadge
                        status={effectiveStatus === "stale" ? "running" : effectiveStatus}
                        startedAt={effectiveStatus === "stale" ? s?.started_at : undefined}
                      />
                      {isActionable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-xs"
                          onClick={(e) => { e.stopPropagation(); onRetriggerHour(agencyId, d, h); }}
                          disabled={retriggeringHours.has(`${agencyId}-d${d}-h${h}`)}
                        >
                          {retriggeringHours.has(`${agencyId}-d${d}-h${h}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="p-1 text-right text-muted-foreground text-xs tabular-nums">
                    {(s?.row_count || 0) > 0 ? s!.row_count.toLocaleString() : "—"}
                  </td>
                  <td className="p-1 text-muted-foreground text-xs">
                    {s?.error_msg && (
                      <span className="text-destructive">{s.error_msg}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </React.Fragment>
        );
      })}

      {mainExpanded && (
        <tr className="border-b border-border/50 bg-muted/10">
          <td className="p-2 pl-6 text-muted-foreground text-xs"></td>
          <td className="p-2 font-mono text-xs text-muted-foreground">cleanup (GC)</td>
          <td className="p-2">{cleanupStatus ? <StatusBadge status={cleanupStatus.status} startedAt={cleanupStatus.started_at} /> : <Badge variant="outline">—</Badge>}</td>
          <td className="p-2 text-right text-muted-foreground text-xs tabular-nums">
            {cleanupStatus?.row_count?.toLocaleString() ?? "—"}
          </td>
          <td className="p-2 text-muted-foreground text-xs">
            {cleanupStatus?.completed_at ? new Date(cleanupStatus.completed_at).toLocaleString() : "—"}
            {cleanupStatus?.error_msg && (
              <p className="text-destructive mt-0.5">{cleanupStatus.error_msg}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminGtfsScreen() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [newAgencyId, setNewAgencyId] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [retriggeringDays, setRetriggeringDays] = useState<Set<string>>(new Set());
  const [retriggeringHours, setRetriggeringHours] = useState<Set<string>>(new Set());
  const [syncingAllDays, setSyncingAllDays] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    const [{ data: feedData }, { data: statusData }] = await Promise.all([
      supabase.from("gtfs_feeds").select("*").order("agency_id"),
      supabase.from("gtfs_sync_status").select("*").order("agency_id"),
    ]);
    setFeeds((feedData as Feed[]) || []);
    setSyncStatuses((statusData as SyncStatus[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const addFeed = async () => {
    if (!newAgencyId.trim() || !newFeedUrl.trim()) return;
    const { error } = await supabase.from("gtfs_feeds").insert({
      agency_id: newAgencyId.trim(),
      feed_url: newFeedUrl.trim(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Feed added" });
      setNewAgencyId("");
      setNewFeedUrl("");
      fetchData();
    }
  };

  const toggleActive = async (feed: Feed) => {
    await supabase.from("gtfs_feeds").update({ is_active: !feed.is_active }).eq("id", feed.id);
    fetchData();
  };

  const deleteFeed = async (feed: Feed) => {
    await supabase.from("gtfs_feeds").delete().eq("id", feed.id);
    toast({ title: `Deleted ${feed.agency_id}` });
    fetchData();
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const callFunction = async (fn: string, agencyId: string, extraParams = ""): Promise<any> => {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/${fn}?agency_id=${encodeURIComponent(agencyId)}${extraParams}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
      }
    );
    if (!res.ok) return null;
    return res.json();
  };

  const syncAgency = async (agencyId: string) => {
    setSyncing(prev => ({ ...prev, [agencyId]: true }));

    // 1. Sync all non-stop_times functions
    for (const fn of SYNC_FUNCTIONS) {
      try {
        if (fn === "gtfs-sync-shapes") {
          await callFunction("gtfs-sync-paginated", agencyId, "&file_type=shapes");
        } else {
          await callFunction(fn, agencyId);
        }
      } catch (e) {
        console.error(`Error calling ${fn} for ${agencyId}:`, e);
      }
    }

    // 2. Sync stop_times via paginated wrapper (handles hours internally)
    for (const dayOffset of DAY_OFFSETS) {
      try {
        await callFunction("gtfs-sync-paginated", agencyId, `&file_type=stop_times&day_offset=${dayOffset}`);
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        console.error(`Error syncing stop_times d${dayOffset} for ${agencyId}:`, e);
      }
    }

    // 3. Cleanup
    try {
      await callFunction("gtfs-sync-stop-times-cleanup", agencyId);
    } catch (e) {
      console.error(`Error in stop_times cleanup for ${agencyId}:`, e);
    }

    setSyncing(prev => ({ ...prev, [agencyId]: false }));
    toast({ title: `Sync complete for ${agencyId}` });
    fetchData();
  };

  const syncStopTimesOnly = async (agencyId: string) => {
    setSyncing(prev => ({ ...prev, [agencyId]: true }));

    for (const dayOffset of DAY_OFFSETS) {
      try {
        await callFunction("gtfs-sync-paginated", agencyId, `&file_type=stop_times&day_offset=${dayOffset}`);
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        console.error(`Error syncing stop_times d${dayOffset} for ${agencyId}:`, e);
      }
    }

    try {
      await callFunction("gtfs-sync-stop-times-cleanup", agencyId);
    } catch (e) {
      console.error(`Error in stop_times cleanup for ${agencyId}:`, e);
    }

    setSyncing(prev => ({ ...prev, [agencyId]: false }));
    toast({ title: `Stop times sync complete for ${agencyId}` });
    fetchData();
  };

  const syncAllDays = async (agencyId: string) => {
    setSyncingAllDays(prev => ({ ...prev, [agencyId]: true }));

    for (const dayOffset of DAY_OFFSETS) {
      try {
        await callFunction("gtfs-sync-paginated", agencyId, `&file_type=stop_times&day_offset=${dayOffset}`);
        await new Promise(r => setTimeout(r, 5000));
        fetchData();
      } catch (e) {
        console.error(`Error syncing ${agencyId} d${dayOffset}:`, e);
      }
    }

    try {
      await callFunction("gtfs-sync-stop-times-cleanup", agencyId);
    } catch (e) {
      console.error(`Error in cleanup for ${agencyId}:`, e);
    }

    setSyncingAllDays(prev => ({ ...prev, [agencyId]: false }));
    toast({ title: `All days synced for ${agencyId}` });
    fetchData();
  };

  const retriggerDay = async (agencyId: string, dayOffset: number) => {
    const key = `${agencyId}-d${dayOffset}`;
    setRetriggeringDays(prev => new Set(prev).add(key));
    try {
      await callFunction("gtfs-sync-paginated", agencyId, `&file_type=stop_times&day_offset=${dayOffset}`);
      toast({ title: `Re-synced ${agencyId} d${dayOffset}` });
    } catch (e) {
      console.error(`Error retriggering ${agencyId} d${dayOffset}:`, e);
      toast({ title: "Re-trigger failed", description: String(e), variant: "destructive" });
    }
    setRetriggeringDays(prev => { const n = new Set(prev); n.delete(key); return n; });
    fetchData();
  };

  const retriggerHour = async (agencyId: string, dayOffset: number, hour: number) => {
    const key = `${agencyId}-d${dayOffset}-h${hour}`;
    setRetriggeringHours(prev => new Set(prev).add(key));
    try {
      // Use paginated wrapper with single_hour=true so it handles multi-page hours (e.g. TTC h8 > 10k rows)
      await callFunction("gtfs-sync-paginated", agencyId, `&file_type=stop_times&day_offset=${dayOffset}&start_hour=${hour}&single_hour=true`);
      toast({ title: `Re-synced ${agencyId} d${dayOffset} h${hour}` });
    } catch (e) {
      console.error(`Error retriggering ${agencyId} d${dayOffset} h${hour}:`, e);
      toast({ title: "Re-trigger failed", description: String(e), variant: "destructive" });
    }
    setRetriggeringHours(prev => { const n = new Set(prev); n.delete(key); return n; });
    fetchData();
  };

  const getAgencyStatuses = (agencyId: string) =>
    syncStatuses.filter(s => s.agency_id === agencyId);

  const isStopTimesType = (fileType: string) =>
    fileType.startsWith("stop_times");

  const regularStatuses = (agencyId: string) =>
    getAgencyStatuses(agencyId).filter(s => !isStopTimesType(s.file_type));

  const stopTimesStatuses = (agencyId: string) =>
    getAgencyStatuses(agencyId).filter(s => isStopTimesType(s.file_type));

  const allAgenciesInStatus = [...new Set(syncStatuses.map(s => s.agency_id))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/map")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">GTFS Feed Admin</h1>
        </div>
        {syncStatuses.some(s => s.status === "running") && (
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              const runningIds = syncStatuses.filter(s => s.status === "running").map(s => s.id);
              for (const id of runningIds) {
                await supabase.from("gtfs_sync_status").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", id);
              }
              toast({ title: `Cancelled ${runningIds.length} running sync(s)` });
              fetchData();
            }}
          >
            <StopCircle className="h-4 w-4 mr-1" />
            Cancel All Syncs
          </Button>
        )}
      </div>

      {/* Add Feed */}
      <Card className="p-4 mb-6 bg-card border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Add New Feed</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Agency ID (e.g. TTC)"
            value={newAgencyId}
            onChange={e => setNewAgencyId(e.target.value)}
            className="w-32"
          />
          <Input
            placeholder="Feed URL (.zip)"
            value={newFeedUrl}
            onChange={e => setNewFeedUrl(e.target.value)}
            className="flex-1"
          />
          <Button onClick={addFeed} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Feeds List */}
      <div className="space-y-3 mb-8">
        <h2 className="text-sm font-medium text-muted-foreground">Feeds</h2>
        {feeds.map(feed => (
          <Card key={feed.id} className="p-4 bg-card border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground">{feed.agency_id}</span>
                  {feed.is_active ? (
                    <Badge className="bg-success/20 text-success border-success/30 text-xs">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Inactive</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{feed.feed_url}</p>
                {feed.last_synced && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last synced: {new Date(feed.last_synced).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={feed.is_active} onCheckedChange={() => toggleActive(feed)} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncStopTimesOnly(feed.agency_id)}
                  disabled={syncing[feed.agency_id]}
                  title="Sync stop_times only (7 days × 28 hours)"
                >
                  {syncing[feed.agency_id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs">ST</span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => syncAgency(feed.agency_id)}
                  disabled={syncing[feed.agency_id]}
                  title="Full sync"
                >
                  {syncing[feed.agency_id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteFeed(feed)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Sync Health Dashboard */}
      {allAgenciesInStatus.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-sm font-medium text-muted-foreground">Sync Health</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allAgenciesInStatus.map(agencyId => {
              const statuses = getAgencyStatuses(agencyId);
              const doneStatuses = statuses.filter(s => s.status === "done" && s.completed_at);
              const lastDone = doneStatuses.length > 0
                ? doneStatuses.sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0]
                : null;
              const hasErrors = statuses.some(s => s.status === "error");
              const hasStale = statuses.some(s => isStaleRunning(s.status, s.started_at));
              const isRunning = statuses.some(s => s.status === "running" && !isStaleRunning(s.status, s.started_at));
              const totalRows = statuses.reduce((acc, s) => acc + (s.row_count || 0), 0);

              const hourEntries = statuses.filter(s => /^stop_times_d\d+_h\d+$/.test(s.file_type) && s.status === "done");
              const totalHours = DAY_OFFSETS.length * HOURS.length; // 196

              const timeSinceSync = lastDone?.completed_at
                ? Date.now() - new Date(lastDone.completed_at).getTime()
                : null;
              const hoursAgo = timeSinceSync ? Math.round(timeSinceSync / 3600000) : null;
              const isStaleSync = hoursAgo !== null && hoursAgo > 26;

              let borderColor = "border-border";
              let Icon = CheckCircle2;
              let iconColor = "text-success";
              if (hasErrors) { borderColor = "border-destructive/40"; Icon = XCircle; iconColor = "text-destructive"; }
              else if (hasStale) { borderColor = "border-warning/40"; Icon = AlertTriangle; iconColor = "text-warning"; }
              else if (isStaleSync) { borderColor = "border-warning/40"; Icon = Clock; iconColor = "text-warning"; }
              else if (isRunning) { borderColor = "border-info/40"; Icon = Loader2; iconColor = "text-info"; }

              return (
                <Card key={agencyId} className={`p-3 bg-card ${borderColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${iconColor} ${isRunning && !hasErrors && !hasStale ? "animate-spin" : ""}`} />
                      <span className="font-semibold text-foreground">{agencyId}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {totalRows.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last sync</span>
                      <span className={isStaleSync ? "text-warning font-medium" : "text-foreground"}>
                        {lastDone?.completed_at
                          ? `${hoursAgo! < 1 ? "< 1h" : `${hoursAgo}h`} ago`
                          : "Never"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Stop times</span>
                      <span className="text-foreground">
                        {hourEntries.length}/{totalHours} hours synced
                      </span>
                    </div>
                    {hasErrors && (
                      <p className="text-xs text-destructive">
                        {statuses.filter(s => s.status === "error").length} error(s)
                      </p>
                    )}
                    {hasStale && (
                      <p className="text-xs text-warning">
                        {statuses.filter(s => isStaleRunning(s.status, s.started_at)).length} stale sync(s)
                      </p>
                    )}
                    {isStaleSync && !hasErrors && !hasStale && (
                      <p className="text-xs text-warning">Missed daily sync window</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Sync Status */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Sync Status</h2>
        {allAgenciesInStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sync data yet. Trigger a sync to see results.</p>
        ) : (
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium">Agency</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">File</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">Rows</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {allAgenciesInStatus.map(agencyId => (
                    <>
                      {regularStatuses(agencyId).map(s => (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="p-3 text-foreground">{s.agency_id}</td>
                          <td className="p-3 text-foreground font-mono text-xs">{s.file_type}</td>
                          <td className="p-3"><StatusBadge status={s.status} startedAt={s.started_at} /></td>
                          <td className="p-3 text-right text-foreground tabular-nums">
                            {s.row_count?.toLocaleString()}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {s.completed_at ? new Date(s.completed_at).toLocaleString() : "—"}
                            {s.error_msg && (
                              <p className="text-destructive mt-1 text-xs">{s.error_msg}</p>
                            )}
                          </td>
                        </tr>
                      ))}

                      {stopTimesStatuses(agencyId).length > 0 && (
                        <StopTimesGroup
                          key={`${agencyId}-stoptimes`}
                          agencyId={agencyId}
                          statuses={stopTimesStatuses(agencyId)}
                          onRetriggerDay={retriggerDay}
                          retriggeringDays={retriggeringDays}
                          onSyncAllDays={syncAllDays}
                          syncingAllDays={!!syncingAllDays[agencyId]}
                          onRetriggerHour={retriggerHour}
                          retriggeringHours={retriggeringHours}
                        />
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
