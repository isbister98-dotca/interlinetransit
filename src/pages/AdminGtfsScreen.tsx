import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SYNC_FUNCTIONS = [
  "gtfs-sync-agency",
  "gtfs-sync-calendar",
  "gtfs-sync-routes",
  "gtfs-sync-stops",
  "gtfs-sync-trips",
  "gtfs-sync-shapes",
  "gtfs-sync-transfers",
  "gtfs-sync-stop-times",
];

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

export default function AdminGtfsScreen() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [newAgencyId, setNewAgencyId] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
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

  const syncAgency = async (agencyId: string) => {
    setSyncing(prev => ({ ...prev, [agencyId]: true }));
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    for (const fn of SYNC_FUNCTIONS) {
      try {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/${fn}?agency_id=${encodeURIComponent(agencyId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
            },
          }
        );
      } catch (e) {
        console.error(`Error calling ${fn} for ${agencyId}:`, e);
      }
    }

    setSyncing(prev => ({ ...prev, [agencyId]: false }));
    toast({ title: `Sync triggered for ${agencyId}` });
    fetchData();
  };

  const statusBadge = (status: string) => {
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
  };

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
                  size="icon"
                  onClick={() => syncAgency(feed.agency_id)}
                  disabled={syncing[feed.agency_id]}
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
        {syncStatuses.length === 0 ? (
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
                  {syncStatuses.map(s => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="p-3 text-foreground">{s.agency_id}</td>
                      <td className="p-3 text-foreground font-mono text-xs">{s.file_type}</td>
                      <td className="p-3">{statusBadge(s.status)}</td>
                      <td className="p-3 text-right text-foreground tabular-nums">{s.row_count?.toLocaleString()}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {s.completed_at ? new Date(s.completed_at).toLocaleString() : "—"}
                        {s.error_msg && (
                          <p className="text-destructive mt-1 text-xs">{s.error_msg}</p>
                        )}
                      </td>
                    </tr>
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
