import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Phone, User, Clock } from "lucide-react";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "新預約", variant: "default" },
  confirmed: { label: "已確認", variant: "secondary" },
  completed: { label: "已完成", variant: "outline" },
  cancelled: { label: "已取消", variant: "destructive" },
};

export default function Appointments() {
  const { data: appointmentsData, isLoading, refetch } = trpc.appointment.list.useQuery();
  const data = appointmentsData?.items;
  const updateStatus = trpc.appointment.updateStatus.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">預約看車管理</h1>
        <p className="text-sm text-muted-foreground">查看客戶提交的預約看車表單</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            目前沒有預約看車紀錄
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((item: any) => {
            const st = statusLabels[item.status] || statusLabels.new;
            const timeDisplay = item.timeFlexible === "yes"
              ? "暫不確定時間（彈性）"
              : `${item.preferredDate || "未選日期"} ${item.preferredTime || ""}`;
            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {item.customerName}
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(item.createdAt).toLocaleString("zh-TW")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-muted-foreground">電話：</span><a href={`tel:${item.phone}`} className="text-primary font-medium">{item.phone}</a></div>
                    <div><span className="text-muted-foreground">車輛：</span>{item.vehicleName || "未指定"}</div>
                    <div className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">時間：</span>{timeDisplay}
                    </div>
                  </div>
                  {item.notes && (
                    <div className="text-sm"><span className="text-muted-foreground">備註：</span>{item.notes}</div>
                  )}
                  <div className="flex gap-2 pt-2">
                    {(["new", "confirmed", "completed", "cancelled"] as const).map(s => (
                      <Button
                        key={s}
                        size="sm"
                        variant={item.status === s ? "default" : "outline"}
                        disabled={item.status === s || updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: item.id, status: s })}
                      >
                        {statusLabels[s].label}
                      </Button>
                    ))}
                    <Button size="sm" variant="secondary" className="ml-auto" asChild>
                      <a href={`tel:${item.phone}`}>
                        <Phone className="h-3.5 w-3.5 mr-1" />
                        撥打電話
                      </a>
                    </Button>
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
