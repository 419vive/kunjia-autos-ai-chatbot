import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  ExternalLink,
  Copy,
  CheckCircle2,
  Loader2,
  Rocket,
  Trash2,
  LayoutGrid,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {step}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        {children}
      </CardContent>
    </Card>
  );
}

function RichMenuPreview() {
  // Rich Menu button labels for preview
  const buttons = [
    { label: "看車庫存", subtitle: "瀏覽所有在售車輛", icon: "🚗" },
    { label: "預約賞車", subtitle: "安排到店看車時間", icon: "📅" },
    { label: "聯絡我們", subtitle: "0936-812-818 賴先生", icon: "📞" },
    { label: "熱門推薦", subtitle: "精選人氣車款", icon: "🔥" },
    { label: "50萬以下", subtitle: "超值好車推薦", icon: "💰" },
    { label: "阿家智能客服", subtitle: "24小時線上諮詢", icon: "💬" },
  ];

  return (
    <div className="rounded-lg overflow-hidden border">
      <div className="grid grid-cols-3 gap-px bg-border">
        {buttons.map((btn, i) => (
          <div
            key={i}
            className="bg-[#1e3c6e] text-white p-3 flex flex-col items-center justify-center text-center min-h-[80px]"
          >
            <span className="text-2xl mb-1">{btn.icon}</span>
            <span className="text-xs font-medium">{btn.label}</span>
            <span className="text-[10px] text-white/60 mt-0.5">{btn.subtitle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RichMenuManager() {
  const [deploySteps, setDeploySteps] = useState<string[]>([]);
  const richMenuStatus = trpc.admin.richMenuStatus.useQuery(undefined, {
    retry: false,
  });

  const deployMutation = trpc.admin.deployRichMenu.useMutation({
    onSuccess: (data) => {
      setDeploySteps(data.steps);
      if (data.success) {
        toast.success("Rich Menu 部署成功！客戶打開聊天室就會看到選單了");
      } else {
        toast.error("Rich Menu 部署失敗，請檢查 LINE 設定");
      }
      richMenuStatus.refetch();
    },
    onError: (err) => {
      toast.error(`部署失敗: ${err.message}`);
    },
  });

  const removeMutation = trpc.admin.removeRichMenu.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("已移除預設 Rich Menu");
      } else {
        toast.error("移除失敗");
      }
      richMenuStatus.refetch();
    },
    onError: (err) => {
      toast.error(`移除失敗: ${err.message}`);
    },
  });

  const isLoading = richMenuStatus.isLoading;
  const status = richMenuStatus.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base">
          <LayoutGrid className="h-5 w-5 text-primary" />
          Rich Menu 圖文選單管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">狀態：</span>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !status?.configured ? (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <AlertCircle className="h-3 w-3 mr-1" />
              LINE 未設定
            </Badge>
          ) : status.hasDefault ? (
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              已啟用
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              未部署
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => richMenuStatus.refetch()}
            disabled={richMenuStatus.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${richMenuStatus.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {status?.hasDefault && (
          <div className="text-xs text-muted-foreground">
            Menu ID: <code className="bg-muted px-1 rounded">{status.defaultMenuId}</code>
          </div>
        )}

        {/* Preview */}
        <div>
          <p className="text-sm font-medium mb-2">選單預覽：</p>
          <RichMenuPreview />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setDeploySteps([]);
              deployMutation.mutate();
            }}
            disabled={deployMutation.isPending || !status?.configured}
            className="flex-1"
          >
            {deployMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            {status?.hasDefault ? "重新部署 Rich Menu" : "部署 Rich Menu"}
          </Button>

          {status?.hasDefault && (
            <Button
              variant="outline"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              {removeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Deploy Steps Log */}
        {deploySteps.length > 0 && (
          <div className="rounded-md bg-muted p-3 space-y-1">
            <p className="text-xs font-medium text-foreground mb-1">部署記錄：</p>
            {deploySteps.map((step, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        )}

        {!status?.configured && (
          <p className="text-xs text-amber-600">
            請先完成上方的 LINE 整合設定（設定 Channel Access Token），才能部署 Rich Menu。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LineSetup() {
  const webhookUrl = `${window.location.origin}/api/line/webhook`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">LINE 整合設定</h1>
        <p className="text-sm text-muted-foreground">
          設定 LINE Official Account、Messaging API 整合與 Rich Menu 圖文選單
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                LINE 整合可實現三大功能：
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
                <li>
                  客戶透過 LINE 官方帳號諮詢時，AI 自動回覆車輛資訊
                </li>
                <li>
                  高品質潛客自動推播通知到老闆的 LINE 帳號
                </li>
                <li>
                  Rich Menu 圖文選單讓客戶一鍵操作常用功能
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rich Menu Management - placed prominently */}
      <RichMenuManager />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">LINE 整合設定步驟</h2>

        <StepCard step={1} title="建立 LINE Official Account">
          <p>
            前往{" "}
            <a
              href="https://manager.line.biz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              LINE Official Account Manager
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            建立或登入您的 LINE 官方帳號。
          </p>
        </StepCard>

        <StepCard step={2} title="啟用 Messaging API">
          <p>
            在 LINE Official Account 設定中，前往「設定」→「Messaging
            API」，點擊「啟用 Messaging API」。
          </p>
          <p>
            前往{" "}
            <a
              href="https://developers.line.biz/console/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              LINE Developers Console
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            取得以下資訊：
          </p>
          <div className="mt-2 space-y-1">
            <Badge variant="outline">Channel ID</Badge>
            <Badge variant="outline" className="ml-2">
              Channel Secret
            </Badge>
            <Badge variant="outline" className="ml-2">
              Channel Access Token
            </Badge>
          </div>
        </StepCard>

        <StepCard step={3} title="設定 Webhook URL">
          <p>在 LINE Developers Console 中，將 Webhook URL 設定為：</p>
          <div className="mt-2 flex items-center gap-2 rounded-md bg-muted p-3 font-mono text-xs">
            <code className="flex-1 break-all">{webhookUrl}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(webhookUrl)}
              className="shrink-0"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-2">
            並開啟「Use webhook」選項，關閉「Auto-reply messages」。
          </p>
        </StepCard>

        <StepCard step={4} title="設定環境變數">
          <p>
            在本系統的「Settings → Secrets」中設定以下環境變數：
          </p>
          <div className="mt-2 space-y-2">
            <div className="rounded-md bg-muted p-2 font-mono text-xs">
              <span className="text-primary">LINE_CHANNEL_ACCESS_TOKEN</span> =
              您的 Channel Access Token
            </div>
            <div className="rounded-md bg-muted p-2 font-mono text-xs">
              <span className="text-primary">LINE_CHANNEL_SECRET</span> = 您的
              Channel Secret
            </div>
            <div className="rounded-md bg-muted p-2 font-mono text-xs">
              <span className="text-primary">LINE_OWNER_USER_ID</span> =
              老闆的 LINE User ID（用於推播通知）
            </div>
          </div>
        </StepCard>

        <StepCard step={5} title="部署 Rich Menu 並測試">
          <p>完成設定後：</p>
          <div className="mt-2 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>點擊上方「部署 Rich Menu」按鈕啟用圖文選單</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>用手機加入您的 LINE 官方帳號</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>確認 Rich Menu 圖文選單顯示在聊天室底部</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>點擊各按鈕測試功能是否正常</span>
            </div>
          </div>
        </StepCard>
      </div>
    </div>
  );
}
