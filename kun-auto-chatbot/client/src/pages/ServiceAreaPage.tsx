import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  Gauge,
  Fuel,
  Calendar,
  ChevronRight,
  ChevronDown,
  MapPin,
  Clock,
  Truck,
  Shield,
  Award,
  CheckCircle,
} from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import SeoFooter from "@/components/SeoFooter";
import StickyBookingBar from "@/components/StickyBookingBar";

const LINE_OA_URL = "https://page.line.me/825oftez";

const SERVICE_AREAS: Record<
  string,
  {
    name: string;
    region: string;
    description: string;
    distance: string;
    driveTime: string;
    shuttleNote: string;
    localKeywords: string[];
    faqs: Array<{ q: string; a: string }>;
  }
> = {
  tainan: {
    name: "台南",
    region: "TW-TNN",
    description:
      "台南買二手車推薦崑家汽車！從台南出發只要40分鐘車程，提供免費接駁服務。崑家汽車高雄在地40年正派經營，全車第三方認證、實車實價、超強貸款方案。台南鄉親買二手車不用跑遠，崑家為您提供最安心的購車體驗。",
    distance: "約50公里",
    driveTime: "約40分鐘",
    shuttleNote: "台南市區免費接駁，專人到府接送看車",
    localKeywords: [
      "台南二手車",
      "台南中古車",
      "台南買二手車",
      "台南二手車推薦",
      "台南中古車行",
    ],
    faqs: [
      {
        q: "台南買二手車推薦哪裡？",
        a: "推薦高雄崑家汽車，在地40年老字號，從台南開車40分鐘即達。提供台南免費接駁服務，全車第三方認證。",
      },
      {
        q: "台南到崑家汽車怎麼去？",
        a: "國道1號或國道3號南下，約40分鐘車程。也可預約免費接駁，專人到台南市區接送。",
      },
      {
        q: "崑家汽車有提供台南送車服務嗎？",
        a: "有，購車後可安排送車到台南，讓您輕鬆交車不用跑高雄。",
      },
      {
        q: "台南二手車貸款怎麼辦？",
        a: "崑家汽車合作多家銀行，台南鄉親一樣享有超強貸款方案，最快一天核准。",
      },
    ],
  },
  pingtung: {
    name: "屏東",
    region: "TW-PIF",
    description:
      "屏東買二手車推薦崑家汽車！從屏東市區只要30分鐘車程，免費接駁直達。在地40年正派經營，全車第三方認證、實車實價。屏東鄉親買中古車，選崑家最安心。",
    distance: "約30公里",
    driveTime: "約30分鐘",
    shuttleNote: "屏東市區免費接駁，最快當日交車",
    localKeywords: [
      "屏東二手車",
      "屏東中古車",
      "屏東買二手車",
      "屏東二手車推薦",
      "屏東中古車行",
    ],
    faqs: [
      {
        q: "屏東買二手車推薦哪裡？",
        a: "推薦高雄崑家汽車，從屏東市區開車僅30分鐘。提供屏東免費接駁，全車第三方認證。",
      },
      {
        q: "屏東到崑家汽車怎麼去？",
        a: "走國道3號或台1線北上，約30分鐘到高雄三民區。可預約免費接駁服務。",
      },
      {
        q: "屏東可以貸款買二手車嗎？",
        a: "可以，崑家合作多家銀行，屏東鄉親一樣適用所有貸款方案。",
      },
      {
        q: "崑家汽車有送車到屏東嗎？",
        a: "有，購車後可安排送車到屏東，當日即可交車。",
      },
    ],
  },
  taichung: {
    name: "台中",
    region: "TW-TXG",
    description:
      "台中買二手車，不妨考慮高雄崑家汽車！崑家提供台中以南免費接駁服務，全車第三方認證、實車實價。在地40年老字號，品質有保障。台中朋友已有許多人專程南下購車，就是信賴崑家的品質與服務。",
    distance: "約180公里",
    driveTime: "約2小時",
    shuttleNote: "台中出發免費接駁，高鐵站接送服務",
    localKeywords: [
      "台中二手車",
      "台中中古車",
      "台中買二手車",
      "台中二手車推薦",
      "台中中古車行",
    ],
    faqs: [
      {
        q: "台中可以到崑家汽車買車嗎？",
        a: "可以！許多台中客人專程南下購車。提供台中免費接駁，高鐵左營站接送服務。",
      },
      {
        q: "台中到崑家汽車怎麼去？",
        a: "搭高鐵到左營站約45分鐘，我們提供高鐵站免費接送。開車走國道1號約2小時。",
      },
      {
        q: "為什麼台中人要到高雄買二手車？",
        a: "崑家汽車40年老字號，車價透明實在，全車第三方認證，很多台中客人買過都推薦親友。",
      },
      {
        q: "台中買車可以貸款嗎？",
        a: "可以，不限地區都能申辦貸款，合作多家銀行，最快一天核准。",
      },
    ],
  },
  chiayi: {
    name: "嘉義",
    region: "TW-CYI",
    description:
      "嘉義買二手車推薦崑家汽車！從嘉義出發約1.5小時車程，提供免費接駁服務。在地40年正派經營，全車第三方認證、超強貸款方案。嘉義鄉親買中古車，崑家品質值得信賴。",
    distance: "約110公里",
    driveTime: "約1.5小時",
    shuttleNote: "嘉義市區免費接駁，高鐵站接送",
    localKeywords: [
      "嘉義二手車",
      "嘉義中古車",
      "嘉義買二手車",
      "嘉義二手車推薦",
      "嘉義中古車行",
    ],
    faqs: [
      {
        q: "嘉義買二手車推薦哪裡？",
        a: "推薦高雄崑家汽車，提供嘉義免費接駁服務，全車第三方認證，在地40年老字號。",
      },
      {
        q: "嘉義到崑家汽車怎麼去？",
        a: "國道1號南下約1.5小時，或搭高鐵到左營站，我們提供免費接送。",
      },
      {
        q: "崑家汽車有送車到嘉義嗎？",
        a: "有，購車後可安排送車到嘉義，交車方便不用再跑一趟。",
      },
      {
        q: "嘉義二手車貸款好辦嗎？",
        a: "崑家合作多家銀行，不限地區皆可申辦，嘉義鄉親一樣享有最優惠方案。",
      },
    ],
  },
};

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
            <p className="text-xs text-muted-foreground">
              {vehicle.modelYear}年款
            </p>
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

function FaqAccordion({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        <span>{faq.q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">
          {faq.a}
        </p>
      )}
    </div>
  );
}

export default function ServiceAreaPage() {
  const [matched, params] = useRoute("/area/:city");
  const [, setLocation] = useLocation();

  const citySlug = params?.city ?? "";
  const area = SERVICE_AREAS[citySlug];

  const { data: vehiclesData, isLoading } = trpc.vehicle.list.useQuery();
  const vehicles = vehiclesData?.items;

  // Redirect if city not found
  if (!area) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#303d4e] text-white">
        <div className="container py-6">
          <a
            href="/"
            className="text-sm text-white/60 hover:text-white/90 transition-colors"
          >
            ← 崑家汽車
          </a>
          <h1
            className="mt-3 text-2xl sm:text-3xl font-bold"
            data-speakable="true"
          >
            {area.name}二手車推薦｜崑家汽車 高雄
          </h1>
          <p
            className="mt-2 text-sm text-white/70 max-w-xl leading-relaxed"
            data-speakable="true"
          >
            {area.description}
          </p>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="border-b bg-muted/30">
        <div className="container py-2">
          <ol className="flex items-center gap-1 text-xs text-muted-foreground">
            <li>
              <a
                href="/"
                className="hover:text-foreground transition-colors"
              >
                首頁
              </a>
            </li>
            <li>
              <ChevronRight className="h-3 w-3" />
            </li>
            <li>
              <span className="text-muted-foreground">服務地區</span>
            </li>
            <li>
              <ChevronRight className="h-3 w-3" />
            </li>
            <li className="font-medium text-foreground">
              {area.name} 二手車
            </li>
          </ol>
        </div>
      </nav>

      <main className="container py-6">
        {/* Info Cards */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {area.name}到崑家汽車交通資訊
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">距離</p>
                  <p className="text-sm font-semibold text-foreground">
                    {area.distance}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">車程</p>
                  <p className="text-sm font-semibold text-foreground">
                    {area.driveTime}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <Car className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">免費接駁</p>
                  <p className="text-sm font-semibold text-foreground">
                    有，專人接送
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">接駁說明</p>
                  <p className="text-sm font-semibold text-foreground">
                    {area.shuttleNote}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why Choose 崑家 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">
            為什麼{area.name}鄉親選擇崑家汽車？
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <Shield className="h-8 w-8 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  第三方認證
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  全車通過第三方專業鑑定，車況透明無隱瞞，買車最安心。
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <Award className="h-8 w-8 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  在地40年老字號
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  高雄在地經營超過40年，正派誠信，口碑深受{area.name}客人信賴。
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <CheckCircle className="h-8 w-8 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  實車實價
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  價格公開透明，不灌水不加價，{area.name}鄉親不用擔心被坑。
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Vehicle Listings */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                崑家汽車在售車款
              </h2>
              {!isLoading && vehicles && (
                <p className="mt-1 text-sm text-muted-foreground">
                  共{" "}
                  <span className="font-semibold text-foreground">
                    {vehicles.length}
                  </span>{" "}
                  台精選二手車等您來看
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
              {Array.from({ length: 6 }).map((_, i) => (
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
          ) : !vehicles || vehicles.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Car className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="text-base font-medium">目前暫無在售車款</p>
              <p className="mt-1 text-sm">
                請稍後再來，或聯繫我們了解最新車況
              </p>
              <div className="mt-6">
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
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          )}
        </section>

        {/* FAQ Section */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {area.name}買二手車常見問題
          </h2>
          <Card>
            <CardContent className="p-4 sm:p-6">
              {area.faqs.map((faq, i) => (
                <FaqAccordion key={i} faq={faq} />
              ))}
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="mb-8 text-center">
          <div className="rounded-xl bg-[#303d4e] px-6 py-10 text-white">
            <h2 className="text-xl font-bold">
              {area.name}鄉親，歡迎預約看車！
            </h2>
            <p className="mt-2 text-sm text-white/70 max-w-md mx-auto">
              免費接駁、第三方認證、超強貸款方案，崑家汽車讓您買車安心又輕鬆。
            </p>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-6 py-3 text-sm font-bold text-white hover:bg-[#05b04c] active:bg-[#049a43] transition-colors"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE 立即預約看車
            </a>
          </div>
        </section>

        {/* Internal links */}
        <div className="rounded-xl border bg-muted/30 p-6">
          <h2 className="text-sm font-bold mb-4">其他服務地區</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(SERVICE_AREAS)
              .filter(([slug]) => slug !== citySlug)
              .map(([slug, a]) => (
                <a
                  key={slug}
                  href={`/area/${slug}`}
                  className="text-xs text-primary hover:underline"
                >
                  {a.name}二手車推薦
                </a>
              ))}
            <a
              href="/price/under-30"
              className="text-xs text-primary hover:underline"
            >
              30萬以下二手車
            </a>
            <a
              href="/price/30-50"
              className="text-xs text-primary hover:underline"
            >
              30-50萬二手車
            </a>
            <a
              href="/price/50-80"
              className="text-xs text-primary hover:underline"
            >
              50-80萬二手車
            </a>
            <a
              href="/price/over-80"
              className="text-xs text-primary hover:underline"
            >
              80萬以上二手車
            </a>
            <a
              href="/blog"
              className="text-xs text-primary hover:underline"
            >
              購車攻略文章
            </a>
            <a
              href="/faq"
              className="text-xs text-primary hover:underline"
            >
              常見問題 FAQ
            </a>
          </div>
        </div>
      </main>

      <SeoFooter />
      <StickyBookingBar />
    </div>
  );
}
