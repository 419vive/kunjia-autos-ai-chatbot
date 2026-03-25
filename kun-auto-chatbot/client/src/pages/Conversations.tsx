import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  User,
  Clock,
  Flame,
  Star,
  Filter,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useState } from "react";
import { Streamdown, defaultRehypePlugins } from "streamdown";

// Exclude KaTeX rehype plugin — LaTeX math is unnecessary for a car dealership chatbot
const { katex: _katex, ...rehypePluginsNoKatex } = defaultRehypePlugins;
const rehypePlugins = Object.values(rehypePluginsNoKatex);

const CHANNEL_LABELS: Record<string, string> = {
  all: "全部渠道",
  web: "網站",
  line: "LINE",
  facebook: "Facebook",
  youtube: "YouTube",
  other: "其他",
};

const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "新客", color: "bg-gray-100 text-gray-700" },
  qualified: { label: "合格", color: "bg-blue-100 text-blue-700" },
  hot: { label: "高品質", color: "bg-red-100 text-red-700" },
  converted: { label: "已成交", color: "bg-green-100 text-green-700" },
  lost: { label: "已流失", color: "bg-gray-100 text-gray-500" },
};

function LeadScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-red-100 text-red-700"
      : score >= 60
        ? "bg-orange-100 text-orange-700"
        : score >= 30
          ? "bg-yellow-100 text-yellow-700"
          : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      <Flame className="h-3 w-3" />
      {score}
    </span>
  );
}

function ConversationDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data, isLoading } = trpc.admin.conversationDetail.useQuery({ id });
  const utils = trpc.useUtils();
  const updateMutation = trpc.admin.updateConversation.useMutation({
    onSuccess: () => {
      utils.admin.conversationDetail.invalidate({ id });
      utils.admin.conversations.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">找不到此對話</p>;
  }

  const conv = data.conversation;
  const statusInfo = LEAD_STATUS_LABELS[conv.leadStatus] || LEAD_STATUS_LABELS.new;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
      </div>

      {/* Conversation Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{conv.customerName || "匿名客戶"}</p>
              <p className="text-xs text-muted-foreground">
                {CHANNEL_LABELS[conv.channel] || conv.channel} &middot;{" "}
                {new Date(conv.createdAt).toLocaleString("zh-TW")}
              </p>
            </div>
            <LeadScoreBadge score={conv.leadScore || 0} />
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Select
              value={conv.leadStatus}
              onValueChange={(val) =>
                updateMutation.mutate({ id: conv.id, leadStatus: val as any })
              }
            >
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={conv.status}
              onValueChange={(val) =>
                updateMutation.mutate({ id: conv.id, status: val as any })
              }
            >
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">進行中</SelectItem>
                <SelectItem value="closed">已關閉</SelectItem>
                <SelectItem value="follow_up">待跟進</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lead Events */}
      {data.leadEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lead 評分事件</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-1.5">
              {data.leadEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                >
                  <span>{evt.reason}</span>
                  <span className="font-medium text-primary">
                    +{evt.scoreChange}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">對話記錄</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {data.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <Streamdown rehypePlugins={rehypePlugins}>{msg.content}</Streamdown>
                    <p className="mt-1 text-[10px] opacity-60">
                      {new Date(msg.createdAt).toLocaleTimeString("zh-TW")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Conversations() {
  const [channel, setChannel] = useState("all");
  const [leadStatus, setLeadStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = trpc.admin.conversations.useQuery({
    channel: channel !== "all" ? channel : undefined,
    leadStatus: leadStatus !== "all" ? leadStatus : undefined,
    limit: 100,
  });

  if (selectedId) {
    return (
      <ConversationDetail id={selectedId} onBack={() => setSelectedId(null)} />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">對話管理</h1>
        <p className="text-sm text-muted-foreground">
          查看與管理所有渠道的客戶對話
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={leadStatus} onValueChange={setLeadStatus}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            共 {data.total} 筆
          </span>
        )}
      </div>

      {/* Conversation List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="py-16 text-center text-muted-foreground">
          <MessageSquare className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>尚無對話記錄</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.items.map((conv) => {
            const statusInfo =
              LEAD_STATUS_LABELS[conv.leadStatus] || LEAD_STATUS_LABELS.new;
            return (
              <Card
                key={conv.id}
                className="transition-colors hover:bg-muted/30 cursor-pointer"
                onClick={() => setSelectedId(conv.id)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {conv.customerName || "匿名客戶"}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {CHANNEL_LABELS[conv.channel] || conv.channel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.summary || "點擊查看對話詳情"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LeadScoreBadge score={conv.leadScore || 0} />
                    <Badge className={`${statusInfo.color} text-[10px]`}>
                      {statusInfo.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
