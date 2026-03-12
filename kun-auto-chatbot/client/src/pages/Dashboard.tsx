import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Users,
  Flame,
  TrendingUp,
  Car,
  BarChart3,
  ArrowRight,
  Bell,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-16" />
            ) : (
              <p className="mt-1 text-2xl font-bold">{value}</p>
            )}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Request browser notification permission on mount */
function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const request = () => {
    if (typeof Notification === "undefined") return;
    if (permission === "default") {
      Notification.requestPermission().then(setPermission);
    }
  };

  const notify = (title: string, body: string) => {
    if (permission !== "granted") return;
    try {
      new Notification(title, { body, icon: "/favicon.ico", tag: "kun-hot-lead" });
    } catch { /* mobile Safari etc */ }
  };

  return { permission, request, notify };
}

/** Live hot lead alerts — polls every 30s for new hot leads */
function HotLeadAlerts() {
  const [, setLocation] = useLocation();
  const browserNotif = useBrowserNotifications();
  const { data: conversations } = trpc.admin.conversations.useQuery(
    { leadStatus: "hot", limit: 5 },
    { refetchInterval: 30_000 }
  );

  const [seenIds, setSeenIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem("kun-seen-hot-leads");
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set<number>();
    } catch { return new Set(); }
  });

  const items = (conversations as any)?.items || [];
  const newLeads = items.filter((c: any) => !seenIds.has(c.id));
  const prevCountRef = useRef(0);

  // Fire browser notification when new leads appear (not on initial load)
  useEffect(() => {
    if (newLeads.length > 0 && newLeads.length > prevCountRef.current) {
      const lead = newLeads[0];
      browserNotif.notify(
        `🔥 新熱客！Score: ${lead.leadScore}`,
        `${lead.customerName || "未知訪客"} · ${lead.channel === "line" ? "LINE" : "網站"}${lead.customerContact ? " · 📞 有電話" : ""}`
      );
    }
    prevCountRef.current = newLeads.length;
  }, [newLeads.length]);

  const dismissAll = () => {
    const allIds = items.map((c: any) => c.id as number);
    const updated = new Set(Array.from(seenIds).concat(allIds));
    setSeenIds(updated);
    localStorage.setItem("kun-seen-hot-leads", JSON.stringify(Array.from(updated)));
  };

  if (newLeads.length === 0) {
    // Still show notification permission prompt if not granted
    if (browserNotif.permission === "default") {
      return (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Bell className="h-4 w-4" />
                <span className="text-sm">開啟瀏覽器通知，即時收到熱客提醒</span>
              </div>
              <button
                onClick={browserNotif.request}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                開啟通知
              </button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <Bell className="h-4 w-4 animate-[bounce_1s_ease-in-out_3]" />
            <span className="text-sm font-semibold">{newLeads.length} 個新熱客提醒</span>
          </div>
          <button onClick={dismissAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            全部已讀
          </button>
        </div>
        <div className="space-y-2">
          {newLeads.slice(0, 3).map((lead: any) => (
            <button
              key={lead.id}
              onClick={() => setLocation(`/admin/conversations`)}
              className="flex items-center justify-between w-full rounded-lg bg-background/80 p-2.5 text-left hover:bg-background transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {lead.customerName || "未知訪客"} · {lead.channel === "line" ? "LINE" : "網站"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lead Score: <span className="font-bold text-orange-600">{lead.leadScore}</span>
                  {lead.customerContact && <span className="ml-2">📞 有電話</span>}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = trpc.admin.dashboard.useQuery({});
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">儀表板</h1>
          <p className="text-sm text-muted-foreground">
            崑家汽車 AI 客服系統總覽
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation("/admin/analytics")}>
          <BarChart3 className="h-4 w-4" />
          完整數據分析
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Real-time hot lead alerts */}
      <HotLeadAlerts />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="總對話數"
          value={data?.stats?.totalConversations ?? 0}
          icon={MessageSquare}
          loading={isLoading}
        />
        <StatCard
          title="合格潛客"
          value={data?.stats?.qualifiedLeads ?? 0}
          icon={Users}
          description="Lead Score ≥ 60"
          loading={isLoading}
        />
        <StatCard
          title="高品質潛客"
          value={data?.stats?.hotLeads ?? 0}
          icon={Flame}
          description="已推播通知"
          loading={isLoading}
        />
        <StatCard
          title="在售車輛"
          value={data?.vehicleCount ?? 0}
          icon={Car}
          loading={isLoading}
        />
      </div>

      {/* Channel Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            渠道分佈
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : data?.stats?.channelBreakdown?.length ? (
            <div className="space-y-3">
              {data.stats.channelBreakdown.map((ch: any) => {
                const total = data.stats?.totalConversations || 1;
                const pct = Math.round((Number(ch.count) / total) * 100);
                const labels: Record<string, string> = {
                  web: "網站",
                  line: "LINE",
                  facebook: "Facebook",
                  youtube: "YouTube",
                  other: "其他",
                };
                return (
                  <div key={ch.channel} className="flex items-center gap-3">
                    <span className="w-20 text-sm font-medium">
                      {labels[ch.channel] || ch.channel}
                    </span>
                    <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/80 transition-all"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm text-muted-foreground">
                      {ch.count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              尚無對話資料
            </p>
          )}
        </CardContent>
      </Card>

      {/* Average Lead Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            平均 Lead 分數
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-4xl font-bold text-primary">
                {Math.round(data?.stats?.avgLeadScore ?? 0)}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
