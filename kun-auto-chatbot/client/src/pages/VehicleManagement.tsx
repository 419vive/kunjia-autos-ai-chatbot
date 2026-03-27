import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";
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
  HandCoins,
  PackageCheck,
  Undo2,
  Video,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: "在售", color: "bg-green-100 text-green-700" },
  reserved: { label: "已收訂", color: "bg-yellow-100 text-yellow-700" },
  sold: { label: "已交車", color: "bg-gray-100 text-gray-500" },
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

/** Inline media editor for video/360 URLs per vehicle */
function VehicleMediaEditor({ vehicleId, currentVideoUrl, currentPhotos360Urls }: {
  vehicleId: number;
  currentVideoUrl: string | null;
  currentPhotos360Urls: string | null;
}) {
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl || "");
  const [photos360, setPhotos360] = useState(
    currentPhotos360Urls ? currentPhotos360Urls.split("|").join("\n") : ""
  );
  const utils = trpc.useUtils();
  const updateMedia = trpc.admin.updateVehicleMedia.useMutation({
    onSuccess: () => {
      utils.admin.vehicles.invalidate();
      toast.success("媒體資料已更新");
    },
    onError: (err) => toast.error(`更新失敗：${err.message}`),
  });

  const handleSave = () => {
    const photos360Urls = photos360
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("|") || null;
    updateMedia.mutate({
      id: vehicleId,
      videoUrl: videoUrl.trim() || null,
      photos360Urls,
    });
  };

  return (
    <div className="border-t px-3 py-3 space-y-3 bg-muted/30">
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <Video className="h-3 w-3" />
          影片連結
        </label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="YouTube 或影片連結"
          className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background"
        />
      </div>
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <RotateCw className="h-3 w-3" />
          360度照片連結
        </label>
        <textarea
          value={photos360}
          onChange={(e) => setPhotos360(e.target.value)}
          placeholder="360度照片連結，每行一個"
          rows={3}
          className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background resize-y"
        />
      </div>
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={handleSave}
        disabled={updateMedia.isPending}
      >
        {updateMedia.isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Save className="mr-1 h-3 w-3" />
        )}
        儲存媒體
      </Button>
    </div>
  );
}

type StatusFilter = "all" | "available" | "reserved" | "sold";

export default function VehicleManagement() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expandedMediaId, setExpandedMediaId] = useState<number | null>(null);
  const { data: vehiclesData, isLoading } = trpc.admin.vehicles.useQuery();
  const vehicles = vehiclesData?.items;
  const utils = trpc.useUtils();
  const updateStatus = trpc.admin.updateVehicleStatus.useMutation({
    onSuccess: (_data, variables) => {
      utils.admin.vehicles.invalidate();
      const label = STATUS_LABELS[variables.status]?.label || variables.status;
      toast.success(`已更新為「${label}」`);
    },
  });

  const availableCount = vehicles?.filter(v => v.status === "available").length || 0;
  const reservedCount = vehicles?.filter(v => v.status === "reserved").length || 0;
  const soldCount = vehicles?.filter(v => v.status === "sold").length || 0;

  const filtered = vehicles?.filter(v => filter === "all" || v.status === filter) || [];

  const TABS: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "全部", count: vehiclesData?.total || 0 },
    { key: "available", label: "在售", count: availableCount },
    { key: "reserved", label: "已收訂", count: reservedCount },
    { key: "sold", label: "已交車", count: soldCount },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">車輛管理</h1>
        <p className="text-sm text-muted-foreground">
          在售 {availableCount} 台 · 已收訂 {reservedCount} 台 · 已交車 {soldCount} 台
        </p>
      </div>

      {/* 8891 Sync Status */}
      <SyncStatusCard />

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1 text-xs opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="py-16 text-center text-muted-foreground">
          <Car className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>{filter === "all" ? "尚無車輛資料" : `沒有「${TABS.find(t => t.key === filter)?.label}」的車輛`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => {
            const photoUrl = v.photoUrls?.split("|")[0] || "";
            const statusInfo = STATUS_LABELS[v.status] || STATUS_LABELS.available;
            return (
              <Card key={v.id} className={`overflow-hidden ${v.status === "sold" ? "opacity-60" : ""}`}>
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
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">
                            {v.brand} {v.model}
                          </h3>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
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
                    {/* Quick action buttons */}
                    <div className="mt-2 flex items-center gap-1.5">
                      {v.status === "available" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: v.id, status: "reserved" })}
                        >
                          <HandCoins className="mr-1 h-3 w-3" />
                          收訂金
                        </Button>
                      )}
                      {v.status === "available" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-gray-500 border-gray-300 hover:bg-gray-50"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: v.id, status: "sold" })}
                        >
                          <PackageCheck className="mr-1 h-3 w-3" />
                          已交車
                        </Button>
                      )}
                      {v.status === "reserved" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-gray-500 border-gray-300 hover:bg-gray-50"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: v.id, status: "sold" })}
                          >
                            <PackageCheck className="mr-1 h-3 w-3" />
                            已交車
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: v.id, status: "available" })}
                          >
                            <Undo2 className="mr-1 h-3 w-3" />
                            恢復在售
                          </Button>
                        </>
                      )}
                      {v.status === "sold" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: v.id, status: "available" })}
                        >
                          <Undo2 className="mr-1 h-3 w-3" />
                          恢復在售
                        </Button>
                      )}
                      {/* Media edit toggle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setExpandedMediaId(expandedMediaId === v.id ? null : v.id)}
                      >
                        {expandedMediaId === v.id ? (
                          <ChevronUp className="mr-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="mr-1 h-3 w-3" />
                        )}
                        影片/360°
                      </Button>
                    </div>
                  </div>
                </CardContent>
                {expandedMediaId === v.id && (
                  <VehicleMediaEditor
                    vehicleId={v.id}
                    currentVideoUrl={(v as any).videoUrl || null}
                    currentPhotos360Urls={(v as any).photos360Urls || null}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
