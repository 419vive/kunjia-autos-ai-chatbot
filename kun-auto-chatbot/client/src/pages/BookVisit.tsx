import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Car, Phone, MapPin, Clock, CheckCircle2, Loader2 } from "lucide-react";

type TimeMode = "flexible" | "specific";

export default function BookVisit() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const vehicleId = params.get("vehicleId");
  const vehicleName = params.get("vehicle") || "";

  const [timeMode, setTimeMode] = useState<TimeMode>("flexible");
  const [preferredDate, setPreferredDate] = useState("");
  const [amPm, setAmPm] = useState<"" | "AM" | "PM">("");
  const [specificTime, setSpecificTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = trpc.appointment.submit.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  // Build today's date string for min attribute
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone) return;

    const preferredTime = timeMode === "specific"
      ? [amPm, specificTime].filter(Boolean).join(" ")
      : "";

    mutation.mutate({
      vehicleId: vehicleId ? Number(vehicleId) : undefined,
      vehicleName: vehicleName || undefined,
      customerName,
      phone,
      preferredDate: timeMode === "specific" ? preferredDate : undefined,
      preferredTime: preferredTime || undefined,
      timeFlexible: timeMode === "flexible" ? "yes" : "no",
      notes: notes || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm mx-auto space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold">預約成功！🎉</h1>
          {vehicleName && (
            <p className="text-sm text-primary font-medium">
              預約車輛：{vehicleName}
            </p>
          )}
          <div className="rounded-xl border bg-muted/30 p-4 text-left space-y-2">
            <p className="text-sm font-semibold text-foreground">接下來會發生什麼？</p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-none">
              <li>1. 賴先生會在 1 小時內電話確認時間</li>
              <li>2. 我們幫您保留看車位置</li>
              <li>3. 看車當天帶身分證即可</li>
            </ol>
            <p className="text-sm text-green-700 font-medium pt-1">💡 來看車不需要付任何費用</p>
          </div>
          <div className="pt-2 space-y-2">
            <a
              href="tel:0936812818"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Phone className="h-4 w-4" />
              直接撥打 0936-812-818
            </a>
            <a
              href="https://page.line.me/825oftez"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#06C755] px-4 py-3 text-sm font-semibold text-white hover:bg-[#05b04c] transition-colors"
            >
              LINE 聯繫我們
            </a>
            <a
              href="/"
              className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              返回首頁看更多車輛
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-primary text-primary-foreground">
        <div className="container flex h-14 items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Car className="h-5 w-5" />
            <span className="font-semibold">崑家汽車</span>
          </a>
          <a
            href="tel:0936812818"
            className="flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25 transition-colors"
          >
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">0936-812-818</span>
          </a>
        </div>
      </header>

      <div className="container max-w-lg mx-auto py-6 px-4">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">預約看車</h1>
          <p className="text-sm text-muted-foreground mt-1">
            預約到店看車，核實車輛在店
          </p>
        </div>

        {/* Shop info card */}
        <div className="rounded-xl border bg-muted/30 p-4 mb-6">
          <p className="font-bold text-base">崑家汽車</p>
          <div className="flex items-start gap-1.5 mt-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
            <span>高雄市三民區大順二路269號</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>週一至週日 09:30–20:00</span>
          </div>
          {vehicleName && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Car className="h-3.5 w-3.5" />
              {vehicleName}
            </div>
          )}
        </div>

        {/* Trust strip */}
        <div className="rounded-lg bg-green-50 px-4 py-3 mb-6 flex items-center justify-center gap-4 flex-wrap text-sm text-green-700 font-medium">
          <span>🔒 資料保密</span>
          <span>⚡ 1小時內回電</span>
          <span>✅ 看車完全免費</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Flexible time checkbox shortcut */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={timeMode === "flexible"}
              onChange={(e) => setTimeMode(e.target.checked ? "flexible" : "specific")}
              className="h-4 w-4 rounded border-gray-300 text-primary accent-primary"
            />
            <span className="text-sm font-medium">我時間彈性，請電話聯絡安排</span>
          </label>

          {/* Time mode selector — only shown when not flexible */}
          {timeMode === "specific" && <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTimeMode("flexible")}
              className="rounded-xl border-2 p-4 text-center transition-all border-muted hover:border-muted-foreground/30"
            >
              <div className="mx-auto mb-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30">
              </div>
              <p className="text-sm font-medium">暫不確定時間</p>
            </button>
            <button
              type="button"
              onClick={() => setTimeMode("specific")}
              className={`rounded-xl border-2 p-4 text-center transition-all ${
                timeMode === "specific"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/30"
              }`}
            >
              <div className={`mx-auto mb-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                timeMode === "specific" ? "border-primary bg-primary" : "border-muted-foreground/30"
              }`}>
                {timeMode === "specific" && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
              <p className="text-sm font-medium">選擇到店時間</p>
            </button>
          </div>}

          {/* Specific time fields — shown only when "選擇到店時間" is selected */}
          {timeMode === "specific" && (
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              {/* Date picker */}
              <div>
                <label className="text-sm font-medium">選擇日期</label>
                <input
                  type="date"
                  value={preferredDate}
                  min={today}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>

              {/* AM / PM selector */}
              <div>
                <label className="text-sm font-medium">上午 / 下午</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setAmPm("AM")}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition-all ${
                      amPm === "AM"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted bg-background hover:border-muted-foreground/30"
                    }`}
                  >
                    🌅 上午 (AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmPm("PM")}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition-all ${
                      amPm === "PM"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted bg-background hover:border-muted-foreground/30"
                    }`}
                  >
                    ☀️ 下午 (PM)
                  </button>
                </div>
              </div>

              {/* Specific time input — only after AM/PM selection */}
              {amPm && (
                <div>
                  <label className="text-sm font-medium">
                    請輸入預約時間
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                    例如：{amPm === "AM" ? "10:00、10:30" : "14:00、15:30"}
                  </p>
                  <input
                    type="text"
                    value={specificTime}
                    onChange={(e) => setSpecificTime(e.target.value)}
                    placeholder={amPm === "AM" ? "例如 10:00" : "例如 14:00"}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              )}
            </div>
          )}

          {/* Customer name */}
          <div>
            <label className="text-sm font-medium">
              您的姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="請輸入您的姓名"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium">
              行動電話 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="請輸入您的手機號碼"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">備註（選填）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="有什麼特別需求可以寫在這裡..."
              rows={2}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending || !customerName || !phone}
            className="w-full rounded-lg bg-[#06C755] px-4 py-3 text-sm font-bold text-white hover:bg-[#05b04c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              "確認預約，等待回電"
            )}
          </button>

          {mutation.isError && (
            <p className="text-center text-sm text-red-500">
              提交失敗，請稍後再試或直接撥打 0936-812-818
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
