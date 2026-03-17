import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Gauge, Fuel, Calendar, ChevronRight } from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import SeoFooter from "@/components/SeoFooter";

const LINE_OA_URL = "https://page.line.me/825oftez";

type PriceRange = "under-30" | "30-50" | "50-80" | "over-80";

interface RangeMeta {
  label: string;
  h1: string;
  description: string;
  filter: (price: number) => boolean;
}

const RANGE_META: Record<PriceRange, RangeMeta> = {
  "under-30": {
    label: "30萬以下",
    h1: "30萬以下二手車推薦｜崑家汽車",
    description:
      "預算有限也能找到好車！崑家汽車精選30萬以下優質二手車，每台車況透明、第三方認證，讓您以實惠的價格安心入手。",
    filter: (p) => p < 30,
  },
  "30-50": {
    label: "30-50萬",
    h1: "30-50萬二手車推薦｜崑家汽車",
    description:
      "30至50萬預算，是二手車市場最熱門的區間。崑家汽車提供各式車款，品質保證、車況透明，幫您找到最超值的選擇。",
    filter: (p) => p >= 30 && p < 50,
  },
  "50-80": {
    label: "50-80萬",
    h1: "50-80萬二手車推薦｜崑家汽車",
    description:
      "中高價位區間，進口車款、SUV 皆有！崑家汽車嚴選50至80萬二手車，品牌多元、車況優良，讓您開得安心、開得有面子。",
    filter: (p) => p >= 50 && p < 80,
  },
  "over-80": {
    label: "80萬以上",
    h1: "80萬以上二手車推薦｜崑家汽車",
    description:
      "頂級車款首選！崑家汽車提供80萬以上精選二手豪華車，每台皆經過嚴格車況檢驗，讓您以合理價格享受頂級駕乘體驗。",
    filter: (p) => p >= 80,
  },
};

function isValidRange(range: string): range is PriceRange {
  return Object.keys(RANGE_META).includes(range);
}

function VehicleCard({ vehicle }: { vehicle: any }) {
  const photos: string[] = vehicle.photoUrls
    ? vehicle.photoUrls.split("|").filter((u: string) => u.trim())
    : [];

  const lineMsg = encodeURIComponent(
    `我想了解這台 ${vehicle.brand} ${vehicle.model} ${vehicle.modelYear}年款 ${vehicle.priceDisplay || vehicle.price + "萬"}`
  );

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {photos.length > 0 ? (
          <ProgressiveImage
            src={photos[0]}
            alt={`${vehicle.brand} ${vehicle.model}`}
            className="transition-transform group-hover:scale-105"
            containerClassName="h-full w-full"
            aspectRatio="16/10"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Car className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs">
          {vehicle.status === "available"
            ? "在售"
            : vehicle.status === "reserved"
            ? "已預訂"
            : "已售出"}
        </Badge>
        {photos.length > 1 && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
            📷 {photos.length}
          </span>
        )}
      </div>
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {vehicle.brand} {vehicle.model}
            </h3>
            <p className="text-xs text-muted-foreground">{vehicle.modelYear}年款</p>
          </div>
          <span className="shrink-0 text-lg font-bold text-primary">
            {vehicle.priceDisplay || `${vehicle.price}萬`}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Gauge className="h-3 w-3" /> {vehicle.mileage || "N/A"}
          </span>
          <span className="flex items-center gap-1">
            <Fuel className="h-3 w-3" /> {vehicle.fuelType || "N/A"}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {vehicle.color || "N/A"}
          </span>
          <span className="flex items-center gap-1">
            <Car className="h-3 w-3" /> {vehicle.transmission || "N/A"}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <a
            href={`/vehicle/${vehicle.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            看詳情
          </a>
          <a
            href={`${LINE_OA_URL}?openQrCodeReader=false&msg=${lineMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#06C755] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#05b04c] active:bg-[#049a43]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            LINE 問車
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PricePage() {
  const [, params] = useRoute("/price/:range");
  const [, setLocation] = useLocation();

  const rawRange = params?.range ?? "";

  if (!isValidRange(rawRange)) {
    setLocation("/");
    return null;
  }

  const range = rawRange as PriceRange;
  const meta = RANGE_META[range];

  const { data: vehicles, isLoading } = trpc.vehicle.list.useQuery();

  const filtered =
    vehicles?.filter((v) => meta.filter(Number(v.price))) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#303d4e] text-white">
        <div className="container py-6">
          <a href="/" className="text-sm text-white/60 hover:text-white/90 transition-colors">
            ← 崑家汽車
          </a>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold">{meta.h1}</h1>
          <p className="mt-2 text-sm text-white/70 max-w-xl">{meta.description}</p>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="border-b bg-muted/30">
        <div className="container py-2">
          <ol className="flex items-center gap-1 text-xs text-muted-foreground">
            <li>
              <a href="/" className="hover:text-foreground transition-colors">
                首頁
              </a>
            </li>
            <li>
              <ChevronRight className="h-3 w-3" />
            </li>
            <li className="font-medium text-foreground">{meta.label} 二手車</li>
          </ol>
        </div>
      </nav>

      {/* Main content */}
      <main className="container py-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                共找到{" "}
                <span className="font-semibold text-foreground">
                  {filtered.length}
                </span>{" "}
                台 {meta.label} 二手車
              </p>
            )}
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            回到全部車款
          </a>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-[16/10]" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Car className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="text-base font-medium">目前沒有 {meta.label} 的車款</p>
            <p className="mt-1 text-sm">請稍後再來，或聯繫我們了解最新車況</p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                回到首頁看全部車款
              </a>
              <a
                href={LINE_OA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#06C755] px-4 py-2 text-sm font-semibold text-white hover:bg-[#05b04c] transition-colors"
              >
                LINE 詢問最新車況
              </a>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        )}

        {/* Internal links section */}
        <div className="mt-12 rounded-xl border bg-muted/30 p-6">
          <h2 className="text-sm font-bold mb-4">其他預算區間</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {range !== "under-30" && <a href="/price/under-30" className="text-xs text-primary hover:underline">30萬以下二手車</a>}
            {range !== "30-50" && <a href="/price/30-50" className="text-xs text-primary hover:underline">30-50萬二手車</a>}
            {range !== "50-80" && <a href="/price/50-80" className="text-xs text-primary hover:underline">50-80萬二手車</a>}
            {range !== "over-80" && <a href="/price/over-80" className="text-xs text-primary hover:underline">80萬以上二手車</a>}
          </div>
          <h2 className="text-sm font-bold mt-6 mb-4">延伸閱讀</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <a href="/blog/buy-used-car-guide" className="text-xs text-primary hover:underline">買二手車7大注意事項</a>
            <a href="/blog/used-car-loan-guide" className="text-xs text-primary hover:underline">二手車貸款全攻略</a>
            <a href="/faq" className="text-xs text-primary hover:underline">常見問題 FAQ</a>
            <a href="/blog" className="text-xs text-primary hover:underline">更多購車攻略</a>
          </div>
        </div>
      </main>

      <SeoFooter />
    </div>
  );
}
