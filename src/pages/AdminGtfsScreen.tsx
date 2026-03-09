import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, RefreshCw, Loader2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
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

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

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

function StopTimesGroup({
  statuses,
  agencyId,
  onRetriggerDay,
  retriggeringDays,
}: {
  statuses: SyncStatus[];
  agencyId: string;
  onRetriggerDay: (agencyId: string, dayOffset: number) => void;
  retriggeringDays: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const dayStatuses = DAY_OFFSETS.map(d => statuses.find(s => s.file_type === `stop_times_d${d}`) ?? null);
  const cleanupStatus = statuses.find(s => s.file_type === "stop_times_cleanup") ?? null;
  const allStatuses = [...dayStatuses.filter(Boolean), cleanupStatus].filter(Boolean) as SyncStatus[];

  const hasStale = allStatuses.some(s => isStaleRunning(s.status, s.started_at));
  const overallStatus = hasStale
    ? "stale"
    : allStatuses.some(s => s.status === "error")
    ? "error"
    : allStatuses.some(s => s.status === "running")
    ? "running"
    : allStatuses.length > 0 && allStatuses.every(s => s.status === "done")
    ? "done"
    : "pending";

  const totalRows = allStatuses.reduce((acc, s) => acc + (s.row_count || 0), 0);
  const lastCompleted = allStatuses
    .filter(s => s.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];

  const dayLabels = ["Today", "Tomorrow", "+2d", "+3d", "+4d", "+5d", "+6d"];

  return (
    <>
      <tr
        className="border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="p-3 text-foreground font-medium">{agencyId}</td>
        <td className="p-3 font-mono text-xs text-foreground flex items-center gap-1">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          stop_times (7d)
          {hasStale && <AlertTriangle className="h-3 w-3 text-warning ml-1" />}
        </td>
        <td className="p-3">
          {overallStatus === "stale" ? (
            <Badge className="bg-warning/20 text-warning border-warning/30 flex items-center gap-1 w-fit">
              <AlertTriangle className="h-3 w-3" /> Stale
            </Badge>
          ) : (
            <StatusBadge status={overallStatus} />
          )}
        </td>
        <td className="p-3 text-right text-foreground tabular-nums">{totalRows.toLocaleString()}</td>
        <td className="p-3 text-muted-foreground text-xs">
          {lastCompleted?.completed_at ? new Date(lastCompleted.completed_at).toLocaleString() : "—"}
        </td>
      </tr>

      {expanded && dayStatuses.map((s, i) => {
        const stale = s ? isStaleRunning(s.status, s.started_at) : false;
        const retriggering = retriggeringDays.has(`${agencyId}-d${i}`);
        return (
          <tr key={`d${i}`} className={`border-b border-border/50 ${stale ? "bg-warning/5" : "bg-muted/10"}`}>
            <td className="p-2 pl-6 text-muted-foreground text-xs"></td>
            <td className="p-2 font-mono text-xs text-muted-foreground">
              <span className={i === 0 ? "text-primary font-semibold" : ""}>
                {dayLabels[i]} (d{i})
              </span>
            </td>
            <td className="p-2">
              <div className="flex items-center gap-2">
                {s ? <StatusBadge status={s.status} startedAt={s.started_at} /> : <Badge variant="outline">—</Badge>}
                {(stale || (s && s.status === "error")) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); onRetriggerDay(agencyId, i); }}
                    disabled={retriggering}
                  >
                    {retriggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </td>
            <td className="p-2 text-right text-muted-foreground text-xs tabular-nums">
              {s?.row_count?.toLocaleString() ?? "—"}
            </td>
            <td className="p-2 text-muted-foreground text-xs">
              {s?.completed_at ? new Date(s.completed_at).toLocaleString() : "—"}
              {s?.error_msg && <p className="text-destructive mt-0.5">{s.error_msg}</p>}
              {stale && s?.started_at && (
                <p className="text-warning mt-0.5">
                  Started {Math.round((Date.now() - new Date(s.started_at).getTime()) / 60000)}m ago — likely timed out
                </p>
              )}
            </td>
          </tr>
        );
      })}

      {expanded && (
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

  const PAGINATED_FUNCTIONS = ["gtfs-sync-shapes", "gtfs-sync-stop-times"];
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
          let page = 0;
          while (true) {
            const result = await callFunction(fn, agencyId, `&page=${page}`);
            const agencyResult = result?.results?.[agencyId];
            if (!agencyResult?.hasMore) break;
            page++;
          }
        } else {
          await callFunction(fn, agencyId);
        }
      } catch (e) {
        console.error(`Error calling ${fn} for ${agencyId}:`, e);
      }
    }

    // 2. Sync stop_times per day: d0 (today) first, then d1–d6
    for (const dayOffset of DAY_OFFSETS) {
      try {
        let page = 0;
        while (true) {
          const result = await callFunction(
            "gtfs-sync-stop-times",
            agencyId,
            `&page=${page}&day_offset=${dayOffset}`
          );
          const agencyResult = result?.results?.[agencyId];
          if (!agencyResult?.hasMore) break;
          page++;
        }
      } catch (e) {
        console.error(`Error syncing stop_times d${dayOffset} for ${agencyId}:`, e);
      }
    }

    // 3. Cleanup (garbage collection)
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

    // Sync stop_times per day: d0 (today) first, then d1–d6
    for (const dayOffset of DAY_OFFSETS) {
      try {
        let page = 0;
        while (true) {
          const result = await callFunction(
            "gtfs-sync-stop-times",
            agencyId,
            `&page=${page}&day_offset=${dayOffset}`
          );
          const agencyResult = result?.results?.[agencyId];
          if (!agencyResult?.hasMore) break;
          page++;
        }
      } catch (e) {
        console.error(`Error syncing stop_times d${dayOffset} for ${agencyId}:`, e);
      }
    }

    // Cleanup (garbage collection)
    try {
      await callFunction("gtfs-sync-stop-times-cleanup", agencyId);
    } catch (e) {
      console.error(`Error in stop_times cleanup for ${agencyId}:`, e);
    }

    setSyncing(prev => ({ ...prev, [agencyId]: false }));
    toast({ title: `Stop times sync complete for ${agencyId}` });
    fetchData();
  };

  const retriggerDay = async (agencyId: string, dayOffset: number) => {
    const key = `${agencyId}-d${dayOffset}`;
    setRetriggeringDays(prev => new Set(prev).add(key));
    try {
      let page = 0;
      while (true) {
        const result = await callFunction(
          "gtfs-sync-stop-times",
          agencyId,
          `&page=${page}&day_offset=${dayOffset}`
        );
        const agencyResult = result?.results?.[agencyId];
        if (!agencyResult?.hasMore) break;
        page++;
      }
      toast({ title: `Re-synced ${agencyId} d${dayOffset}` });
    } catch (e) {
      console.error(`Error retriggering ${agencyId} d${dayOffset}:`, e);
      toast({ title: "Re-trigger failed", description: String(e), variant: "destructive" });
    }
    setRetriggeringDays(prev => { const n = new Set(prev); n.delete(key); return n; });
    fetchData();
  };

  // Group statuses by agency for the stop_times section
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
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/map")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">GTFS Feed Admin</h1>
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
                  title="Sync stop_times only (7 days)"
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
                      {/* Regular file types (non-stop_times) */}
                      {regularStatuses(agencyId).map(s => (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="p-3 text-foreground">{s.agency_id}</td>
                          <td className="p-3 text-foreground font-mono text-xs">{s.file_type}</td>
                          <td className="p-3"><StatusBadge status={s.status} /></td>
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

                      {/* Stop Times grouped row (expandable) */}
                      {stopTimesStatuses(agencyId).length > 0 && (
                        <StopTimesGroup
                          key={`${agencyId}-stoptimes`}
                          agencyId={agencyId}
                          statuses={stopTimesStatuses(agencyId)}
                          onRetriggerDay={retriggerDay}
                          retriggeringDays={retriggeringDays}
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
