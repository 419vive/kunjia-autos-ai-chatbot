import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Car,
  ExternalLink,
  Fuel,
  Gauge,
  Calendar,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: "在售", color: "bg-green-100 text-green-700" },
  sold: { label: "已售出", color: "bg-gray-100 text-gray-500" },
  reserved: { label: "已預訂", color: "bg-yellow-100 text-yellow-700" },
};

const SYNC_STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  success: { label: "同步成功", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
  partial: { label: "部分成功", icon: <AlertCircle className="h-4 w-4" />, color: "text-yellow-600" },
  failed: { label: "同步失敗", icon: <XCircle className="h-4 w-4" />, color: "text-red-600" },
  running: { label: "同步中...", icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "text-blue-600" },
  never: { label: "尚未同步", icon: <Clock className="h-4 w-4" />, color: "text-muted-foreground" },
};

function SyncStatusCard() {
  const { data: syncStatus, isLoading: syncLoading } = trpc.admin.syncStatus.useQuery(undefined, {
    refetchInterval: 10000, // Poll every 10s when sync might be running
  });
  const utils = trpc.useUtils();
  const triggerSync = trpc.admin.triggerSync.useMutation({
    onMutate: () => {
      toast.info("正在從 8891 同步車輛資料...");
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      utils.admin.syncStatus.invalidate();
      utils.admin.vehicles.invalidate();
    },
    onError: (err) => {
      toast.error(`同步失敗：${err.message}`);
    },
  });

  const status = syncStatus?.lastSyncStatus || "never";
  const statusInfo = SYNC_STATUS_MAP[status] || SYNC_STATUS_MAP.never;

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">8891 自動同步</h3>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </span>
            </div>
            {syncLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              <div className="space-y-0.5">
                {syncStatus?.lastSyncTime && (
                  <p className="text-xs text-muted-foreground">
                    上次同步：{new Date(syncStatus.lastSyncTime).toLocaleString("zh-TW")}
                  </p>
                )}
                {syncStatus?.lastSyncMessage && (
                  <p className="text-xs text-muted-foreground">{syncStatus.lastSyncMessage}</p>
                )}
                {syncStatus?.lastSyncVehicleCount !== undefined && syncStatus.lastSyncVehicleCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    8891 在售車輛：{syncStatus.lastSyncVehicleCount} 台
                  </p>
                )}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending || syncStatus?.syncInProgress}
            className="shrink-0"
          >
            {triggerSync.isPending || syncStatus?.syncInProgress ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            {triggerSync.isPending || syncStatus?.syncInProgress ? "同步中..." : "立即同步"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          系統每 6 小時自動從 8891 崑家汽車同步最新車輛資料。新增、改價、下架都會自動更新。
        </p>
      </CardContent>
    </Card>
  );
}

export default function VehicleManagement() {
  const { data: vehicles, isLoading } = trpc.admin.vehicles.useQuery();
  const utils = trpc.useUtils();
  const updateStatus = trpc.admin.updateVehicleStatus.useMutation({
    onSuccess: () => {
      utils.admin.vehicles.invalidate();
      toast.success("車輛狀態已更新");
    },
  });

  const availableCount = vehicles?.filter(v => v.status === "available").length || 0;
  const soldCount = vehicles?.filter(v => v.status === "sold").length || 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">車輛管理</h1>
        <p className="text-sm text-muted-foreground">
          管理在售車輛庫存與狀態 · 在售 {availableCount} 台 · 已售 {soldCount} 台
        </p>
      </div>

      {/* 8891 Sync Status */}
      <SyncStatusCard />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !vehicles?.length ? (
        <div className="py-16 text-center text-muted-foreground">
          <Car className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>尚無車輛資料</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => {
            const photoUrl = v.photoUrls?.split("|")[0] || "";
            const statusInfo = STATUS_LABELS[v.status] || STATUS_LABELS.available;
            return (
              <Card key={v.id} className="overflow-hidden">
                <CardContent className="flex gap-4 p-3">
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={`${v.brand} ${v.model}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Car className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {v.brand} {v.model}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {v.modelYear}年 &middot; {v.color} &middot;{" "}
                          {v.mileage}
                        </p>
                      </div>
                      <span className="text-base font-bold text-primary shrink-0">
                        {v.priceDisplay || `${v.price}萬`}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Fuel className="h-3 w-3" />
                        {v.fuelType}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Gauge className="h-3 w-3" />
                        {v.displacement}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {v.licenseDate}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Select
                        value={v.status}
                        onValueChange={(val) =>
                          updateStatus.mutate({
                            id: v.id,
                            status: val as any,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, s]) => (
                            <SelectItem key={k} value={k}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {v.sourceUrl && (
                        <a
                          href={v.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          8891
                        </a>
                      )}
                    </div>
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
