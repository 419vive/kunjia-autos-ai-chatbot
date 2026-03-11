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
} from "lucide-react";
import { useLocation } from "wouter";

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
