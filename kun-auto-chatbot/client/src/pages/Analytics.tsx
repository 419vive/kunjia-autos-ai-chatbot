import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  Eye, Users, Clock, Globe, Monitor, Smartphone,
  ArrowDownToLine, RefreshCw, Filter, ChevronDown,
  TrendingUp, Flame, MessageSquare, Car, Target,
  MousePointerClick,
} from "lucide-react";

// ============ DATE RANGE PRESETS ============

const DATE_RANGES = [
  { label: "最近24小時", value: "24h", days: 1 },
  { label: "最近7天", value: "7d", days: 7 },
  { label: "最近14天", value: "14d", days: 14 },
  { label: "最近30天", value: "30d", days: 30 },
  { label: "最近90天", value: "90d", days: 90 },
  { label: "全部時間", value: "all", days: 0 },
] as const;

function getDateRange(days: number) {
  if (days === 0) return {};
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

// ============ TABS ============

type TabId = "website" | "chatbot" | "line";

const TABS = [
  { id: "website" as TabId, label: "網站流量", icon: Globe },
  { id: "chatbot" as TabId, label: "聊天機器人", icon: MessageSquare },
  { id: "line" as TabId, label: "LINE 互動", icon: MousePointerClick },
];

// ============ CHART COLORS ============

const COLORS = [
  "hsl(220, 70%, 55%)", "hsl(160, 60%, 45%)", "hsl(30, 80%, 55%)",
  "hsl(280, 60%, 55%)", "hsl(350, 65%, 55%)", "hsl(190, 70%, 45%)",
  "hsl(60, 70%, 50%)", "hsl(120, 50%, 45%)",
];

// ============ CSV DOWNLOAD HELPER ============

function downloadCsv(csv: string, filename: string) {
  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============ STAT CARD ============

function StatCard({ title, value, icon: Icon, description, loading }: {
  title: string; value: string | number; icon: any; description?: string; loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? <Skeleton className="mt-1 h-8 w-16" /> : <p className="mt-1 text-2xl font-bold">{value}</p>}
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ RANKING TABLE ============

function RankingTable({ title, data, columns, loading }: {
  title: string;
  data: Array<Record<string, any>>;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">尚無資料</p>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center text-xs font-medium text-muted-foreground pb-1 border-b">
              {columns.map(col => (
                <span key={col.key} className={`flex-1 ${col.align === "right" ? "text-right" : ""}`}>{col.label}</span>
              ))}
            </div>
            {data.slice(0, 10).map((row, i) => (
              <div key={i} className="flex items-center py-1.5 text-sm hover:bg-muted/50 rounded px-1 -mx-1">
                {columns.map(col => (
                  <span key={col.key} className={`flex-1 truncate ${col.align === "right" ? "text-right tabular-nums font-medium" : ""}`}>
                    {row[col.key] ?? "-"}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MAIN ANALYTICS PAGE ============

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<TabId>("website");
  const [dateRange, setDateRange] = useState("30d");
  const [showDateMenu, setShowDateMenu] = useState(false);

  const selectedRange = DATE_RANGES.find(r => r.value === dateRange) || DATE_RANGES[3];
  const dateParams = useMemo(() => getDateRange(selectedRange.days), [selectedRange.days]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">數據分析</h1>
          <p className="text-sm text-muted-foreground">網站流量、聊天機器人、LINE 互動全方位分析</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowDateMenu(!showDateMenu)}
            >
              <Filter className="h-3.5 w-3.5" />
              {selectedRange.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {showDateMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-lg border bg-popover p-1 shadow-md min-w-[140px]">
                {DATE_RANGES.map(r => (
                  <button
                    key={r.value}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent ${r.value === dateRange ? "bg-accent font-medium" : ""}`}
                    onClick={() => { setDateRange(r.value); setShowDateMenu(false); }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "website" && <WebsiteTab dateParams={dateParams} />}
      {activeTab === "chatbot" && <ChatbotTab dateParams={dateParams} />}
      {activeTab === "line" && <LineTab dateParams={dateParams} />}

      {/* Export Section */}
      <ExportSection dateParams={dateParams} />
    </div>
  );
}

// ============ WEBSITE TAB (Umami-style) ============

function WebsiteTab({ dateParams }: { dateParams: { startDate?: string; endDate?: string } }) {
  const summary = trpc.admin.webSummary.useQuery(dateParams);
  const visitors = trpc.admin.dailyVisitors.useQuery(dateParams);
  const topPages = trpc.admin.topPages.useQuery(dateParams);
  const referrers = trpc.admin.topReferrers.useQuery(dateParams);
  const browsers = trpc.admin.browserStats.useQuery(dateParams);
  const osStats = trpc.admin.osStats.useQuery(dateParams);
  const devices = trpc.admin.deviceStats.useQuery(dateParams);
  const countries = trpc.admin.countryStats.useQuery(dateParams);

  const visitorChartConfig: ChartConfig = {
    pageViews: { label: "瀏覽量", color: "hsl(220, 70%, 55%)" },
    visitors: { label: "訪客", color: "hsl(160, 60%, 45%)" },
  };

  const formatDuration = (s: number) => {
    if (!s) return "0s";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <StatCard title="Page Views" value={summary.data?.pageViews ?? 0} icon={Eye} loading={summary.isLoading} />
        <StatCard title="Visitors" value={summary.data?.uniqueVisitors ?? 0} icon={Users} loading={summary.isLoading} />
        <StatCard
          title="Avg. Duration"
          value={formatDuration(summary.data?.avgDuration ?? 0)}
          icon={Clock}
          loading={summary.isLoading}
        />
      </div>

      {/* Visitor Time-Series Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">訪客趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          {visitors.isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : visitors.data && visitors.data.length > 0 ? (
            <ChartContainer config={visitorChartConfig} className="h-[250px] w-full">
              <AreaChart data={visitors.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }} className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="pageViews" stroke="var(--color-pageViews)" fill="var(--color-pageViews)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="visitors" stroke="var(--color-visitors)" fill="var(--color-visitors)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">尚無訪客資料，資料會隨訪客瀏覽自動累積</p>
          )}
        </CardContent>
      </Card>

      {/* Two-column: Pages + Referrers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RankingTable
          title="Most viewed pages"
          data={(topPages.data || []).map((p: any) => p)}
          columns={[
            { key: "path", label: "PAGE" },
            { key: "visitors", label: "VISITORS", align: "right" },
          ]}
          loading={topPages.isLoading}
        />
        <RankingTable
          title="Referrers"
          data={(referrers.data || []).map((r: any) => r)}
          columns={[
            { key: "referrerDomain", label: "REFERRER" },
            { key: "visitors", label: "VISITORS", align: "right" },
          ]}
          loading={referrers.isLoading}
        />
      </div>

      {/* Three-column: Browser / OS / Device */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <RankingTable
          title="Browsers"
          data={(browsers.data || []).map((b: any) => b)}
          columns={[
            { key: "browser", label: "BROWSER" },
            { key: "visitors", label: "VISITORS", align: "right" },
          ]}
          loading={browsers.isLoading}
        />
        <RankingTable
          title="OS"
          data={(osStats.data || []).map((o: any) => o)}
          columns={[
            { key: "os", label: "OS" },
            { key: "visitors", label: "VISITORS", align: "right" },
          ]}
          loading={osStats.isLoading}
        />
        <RankingTable
          title="Devices"
          data={(devices.data || []).map((d: any) => d)}
          columns={[
            { key: "device", label: "DEVICE" },
            { key: "visitors", label: "VISITORS", align: "right" },
          ]}
          loading={devices.isLoading}
        />
      </div>

      {/* Country */}
      <RankingTable
        title="Countries / Regions"
        data={(countries.data || []).map((c: any) => c)}
        columns={[
          { key: "country", label: "COUNTRY" },
          { key: "visitors", label: "VISITORS", align: "right" },
        ]}
        loading={countries.isLoading}
      />
    </div>
  );
}

// ============ CHATBOT TAB ============

function ChatbotTab({ dateParams }: { dateParams: { startDate?: string; endDate?: string } }) {
  const dashboard = trpc.admin.dashboard.useQuery({});
  const dailyConvos = trpc.admin.dailyConversations.useQuery(dateParams);
  const dailyMsgs = trpc.admin.dailyMessages.useQuery(dateParams);
  const funnel = trpc.admin.leadFunnel.useQuery(dateParams);
  const scoreDist = trpc.admin.leadScoreDistribution.useQuery();
  const popularVehicles = trpc.admin.popularVehicles.useQuery();
  const eventBreakdown = trpc.admin.leadEventBreakdown.useQuery(dateParams);

  // Aggregate daily conversation data
  const convoChartData = useMemo(() => {
    if (!dailyConvos.data) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const row of dailyConvos.data) {
      const d = row.date;
      if (!dateMap.has(d)) dateMap.set(d, { date: 0 } as any);
      const entry = dateMap.get(d)!;
      (entry as any).date = d;
      (entry as any)[row.channel] = (Number((entry as any)[row.channel]) || 0) + Number(row.count);
      (entry as any).total = (Number((entry as any).total) || 0) + Number(row.count);
    }
    return Array.from(dateMap.values());
  }, [dailyConvos.data]);

  // Aggregate daily message data
  const msgChartData = useMemo(() => {
    if (!dailyMsgs.data) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const row of dailyMsgs.data) {
      const d = row.date;
      if (!dateMap.has(d)) dateMap.set(d, {} as any);
      const entry = dateMap.get(d)!;
      (entry as any).date = d;
      (entry as any)[row.role] = Number(row.count);
    }
    return Array.from(dateMap.values());
  }, [dailyMsgs.data]);

  const convoChartConfig: ChartConfig = {
    total: { label: "總對話", color: "hsl(220, 70%, 55%)" },
    line: { label: "LINE", color: "hsl(160, 60%, 45%)" },
    web: { label: "網站", color: "hsl(30, 80%, 55%)" },
  };

  const msgChartConfig: ChartConfig = {
    user: { label: "用戶訊息", color: "hsl(220, 70%, 55%)" },
    assistant: { label: "AI 回覆", color: "hsl(160, 60%, 45%)" },
  };

  // Funnel data
  const funnelLabels: Record<string, string> = {
    new: "新客", qualified: "合格", hot: "熱客", converted: "成交", lost: "流失",
  };
  const funnelOrder = ["new", "qualified", "hot", "converted", "lost"];

  const funnelData = useMemo(() => {
    if (!funnel.data) return [];
    return funnelOrder.map(status => {
      const item = (funnel.data as any[]).find((f: any) => f.leadStatus === status);
      return { name: funnelLabels[status] || status, count: Number(item?.count || 0), avgScore: Number(item?.avgScore || 0) };
    });
  }, [funnel.data]);

  // Lead event breakdown for pie chart
  const eventLabels: Record<string, string> = {
    budget_inquiry: "預算詢問", purchase_intent: "購買意向", visit_intent: "看車意願",
    contact_request: "索取聯繫", trade_in: "舊車換新", urgency: "時間急迫",
    specific_vehicle: "指定車款", life_event: "人生事件", specific_budget: "具體預算",
    faq_interaction: "FAQ互動",
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="總對話數" value={dashboard.data?.stats?.totalConversations ?? 0} icon={MessageSquare} loading={dashboard.isLoading} />
        <StatCard title="合格潛客" value={dashboard.data?.stats?.qualifiedLeads ?? 0} icon={Users} description="Lead Score >= 60" loading={dashboard.isLoading} />
        <StatCard title="高品質潛客" value={dashboard.data?.stats?.hotLeads ?? 0} icon={Flame} loading={dashboard.isLoading} />
        <StatCard title="在售車輛" value={dashboard.data?.vehicleCount ?? 0} icon={Car} loading={dashboard.isLoading} />
      </div>

      {/* Conversation Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">對話量趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyConvos.isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : convoChartData.length > 0 ? (
            <ChartContainer config={convoChartConfig} className="h-[250px] w-full">
              <BarChart data={convoChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }} className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">尚無對話資料</p>
          )}
        </CardContent>
      </Card>

      {/* Message Volume Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">訊息量趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyMsgs.isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : msgChartData.length > 0 ? (
            <ChartContainer config={msgChartConfig} className="h-[250px] w-full">
              <AreaChart data={msgChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }} className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="user" stroke="var(--color-user)" fill="var(--color-user)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="assistant" stroke="var(--color-assistant)" fill="var(--color-assistant)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">尚無訊息資料</p>
          )}
        </CardContent>
      </Card>

      {/* Two-column: Lead Funnel + Score Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Conversion Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4" /> 潛客轉換漏斗
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : funnelData.length > 0 ? (
              <div className="space-y-3">
                {funnelData.map((item, i) => {
                  const maxCount = Math.max(...funnelData.map(f => f.count), 1);
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground">{item.count} <span className="text-xs">(avg: {item.avgScore})</span></span>
                      </div>
                      <div className="h-5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">尚無資料</p>
            )}
          </CardContent>
        </Card>

        {/* Lead Score Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" /> Lead Score 分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDist.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : scoreDist.data && scoreDist.data.length > 0 ? (
              <ChartContainer config={{ count: { label: "人數", color: "hsl(220, 70%, 55%)" } }} className="h-[200px] w-full">
                <BarChart data={scoreDist.data.map((d: any) => ({ range: d.range, count: Number(d.count) }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">尚無資料</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Lead Event Breakdown + Popular Vehicles */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RankingTable
          title="Lead 得分事件分布"
          data={(eventBreakdown.data || []).map((e: any) => ({
            eventType: eventLabels[e.eventType] || e.eventType,
            count: Number(e.count),
            totalScore: Number(e.totalScore),
          }))}
          columns={[
            { key: "eventType", label: "事件類型" },
            { key: "count", label: "次數", align: "right" },
            { key: "totalScore", label: "總分", align: "right" },
          ]}
          loading={eventBreakdown.isLoading}
        />
        <RankingTable
          title="熱門車款（客戶最感興趣）"
          data={(popularVehicles.data || []).map((v: any) => ({
            vehicle: `${v.brand} ${v.model}`,
            price: v.priceDisplay || `${v.price}萬`,
            interestCount: v.interestCount,
          }))}
          columns={[
            { key: "vehicle", label: "車款" },
            { key: "price", label: "售價", align: "right" },
            { key: "interestCount", label: "詢問數", align: "right" },
          ]}
          loading={popularVehicles.isLoading}
        />
      </div>
    </div>
  );
}

// ============ LINE TAB ============

function LineTab({ dateParams }: { dateParams: { startDate?: string; endDate?: string } }) {
  const lineAnalytics = trpc.admin.lineAnalytics.useQuery(dateParams);

  // Group by category
  const grouped = useMemo(() => {
    if (!lineAnalytics.data) return {};
    const groups: Record<string, Array<{ action: string; count: number }>> = {};
    for (const item of lineAnalytics.data as any[]) {
      const cat = item.eventCategory;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ action: item.eventAction, count: Number(item.count) });
    }
    return groups;
  }, [lineAnalytics.data]);

  const categoryLabels: Record<string, string> = {
    line_follow: "新加好友",
    line_unfollow: "取消追蹤",
    rich_menu: "Rich Menu 點擊",
    faq_click: "FAQ 點擊",
    photo_view: "看照片",
    quick_reply: "Quick Reply 點擊",
    message: "訊息互動",
  };

  const totalByCategory = useMemo(() => {
    return Object.entries(grouped).map(([cat, items]) => ({
      category: categoryLabels[cat] || cat,
      count: items.reduce((sum, i) => sum + i.count, 0),
    })).sort((a, b) => b.count - a.count);
  }, [grouped]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <StatCard
          title="新追蹤者"
          value={grouped["line_follow"]?.reduce((s, i) => s + i.count, 0) ?? 0}
          icon={Users}
          loading={lineAnalytics.isLoading}
        />
        <StatCard
          title="Rich Menu 互動"
          value={grouped["rich_menu"]?.reduce((s, i) => s + i.count, 0) ?? 0}
          icon={MousePointerClick}
          loading={lineAnalytics.isLoading}
        />
        <StatCard
          title="FAQ 點擊"
          value={grouped["faq_click"]?.reduce((s, i) => s + i.count, 0) ?? 0}
          icon={MessageSquare}
          loading={lineAnalytics.isLoading}
        />
      </div>

      {/* Event Category Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">LINE 事件分布</CardTitle>
        </CardHeader>
        <CardContent>
          {lineAnalytics.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : totalByCategory.length > 0 ? (
            <div className="space-y-3">
              {totalByCategory.map((item, i) => {
                const maxCount = Math.max(...totalByCategory.map(t => t.count), 1);
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="w-32 text-sm font-medium truncate">{item.category}</span>
                    <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm tabular-nums font-medium">{item.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">尚無 LINE 互動資料，用戶開始使用後會自動記錄</p>
          )}
        </CardContent>
      </Card>

      {/* Detailed breakdown by category */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Object.entries(grouped).map(([cat, items]) => (
          <RankingTable
            key={cat}
            title={categoryLabels[cat] || cat}
            data={items.sort((a, b) => b.count - a.count)}
            columns={[
              { key: "action", label: "動作" },
              { key: "count", label: "次數", align: "right" },
            ]}
            loading={lineAnalytics.isLoading}
          />
        ))}
      </div>
    </div>
  );
}

// ============ EXPORT SECTION ============

function ExportSection({ dateParams }: { dateParams: { startDate?: string; endDate?: string } }) {
  const exportConvos = trpc.admin.exportConversations.useQuery(dateParams, { enabled: false });
  const exportEvents = trpc.admin.exportLeadEvents.useQuery(dateParams, { enabled: false });
  const exportVehicles = trpc.admin.exportVehicles.useQuery(undefined, { enabled: false });

  const handleExport = async (type: "conversations" | "leadEvents" | "vehicles") => {
    try {
      if (type === "conversations") {
        const data = await exportConvos.refetch();
        if (data.data) downloadCsv(data.data.csv, data.data.filename);
      } else if (type === "leadEvents") {
        const data = await exportEvents.refetch();
        if (data.data) downloadCsv(data.data.csv, data.data.filename);
      } else {
        const data = await exportVehicles.refetch();
        if (data.data) downloadCsv(data.data.csv, data.data.filename);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ArrowDownToLine className="h-4 w-4" />
          匯出報表 (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("conversations")}
            disabled={exportConvos.isFetching}
          >
            {exportConvos.isFetching ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />}
            對話資料
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("leadEvents")}
            disabled={exportEvents.isFetching}
          >
            {exportEvents.isFetching ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />}
            Lead 事件
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("vehicles")}
            disabled={exportVehicles.isFetching}
          >
            {exportVehicles.isFetching ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />}
            車輛庫存
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          CSV 檔案支援 Excel 開啟，包含 UTF-8 BOM 確保中文正確顯示
        </p>
      </CardContent>
    </Card>
  );
}
