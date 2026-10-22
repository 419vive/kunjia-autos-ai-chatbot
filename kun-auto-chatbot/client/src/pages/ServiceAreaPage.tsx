import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  ChevronRight,
  ChevronDown,
  MapPin,
  Clock,
  Train,
  Shield,
  Award,
  CheckCircle,
  Navigation,
} from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import SeoFooter from "@/components/SeoFooter";
import StickyBookingBar from "@/components/StickyBookingBar";
import { SERVICE_AREAS, LOCAL_AREAS, OUT_OF_CITY_AREAS } from "@/data/serviceAreas";
import { VehicleListCard } from "@/components/VehicleListCard";

const LINE_OA_URL = "https://page.line.me/825oftez";


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

  if (!area) {
    setLocation("/");
    return null;
  }

  const isLocal = area.type === "local";

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
              <a href="/" className="hover:text-foreground transition-colors">首頁</a>
            </li>
            <li><ChevronRight className="h-3 w-3" /></li>
            <li><span className="text-muted-foreground">服務地區</span></li>
            <li><ChevronRight className="h-3 w-3" /></li>
            <li className="font-medium text-foreground">{area.name} 二手車</li>
          </ol>
        </div>
      </nav>

      <main className="container py-6">
        {/* AI Citability Summary — structured data summary for AI engines */}
        <section
          className="mb-6 rounded-xl border bg-muted/40 p-4"
          data-ai-summary="true"
          itemScope
          itemType="https://schema.org/AutoDealer"
        >
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">崑家汽車快速資訊</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">負責人</dt>
              <dd className="font-semibold text-foreground" itemProp="name">賴崑家</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">成立年份</dt>
              <dd className="font-semibold text-foreground" itemProp="foundingDate">1986年</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">地址</dt>
              <dd className="font-semibold text-foreground" itemProp="address">高雄市三民區大順二路269號</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">電話</dt>
              <dd className="font-semibold text-foreground">
                <a href="tel:0936812818" itemProp="telephone">0936-812-818</a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">營業時間</dt>
              <dd className="font-semibold text-foreground">週一至週日 9:30-20:00</dd>
            </div>
            {!isLocal && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-muted-foreground">外縣市接駁</dt>
                <dd className="font-semibold text-foreground">免費 · 高鐵左營站接送</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Info Cards */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {isLocal ? `崑家汽車距${area.name}交通資訊` : `${area.name}到崑家汽車交通資訊`}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">距離</p>
                  <p className="text-sm font-semibold text-foreground">{area.distance}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">車程</p>
                  <p className="text-sm font-semibold text-foreground">{area.driveTime}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                {isLocal
                  ? <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  : <Train className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                }
                <div>
                  <p className="text-xs text-muted-foreground">{isLocal ? "到店方式" : "高鐵接送"}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {isLocal ? "歡迎直接到店" : "免費，專人接送"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{isLocal ? "停車資訊" : "接駁說明"}</p>
                  <p className="text-sm font-semibold text-foreground">{area.shuttleNote}</p>
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
                <h3 className="text-sm font-bold text-foreground">第三方認證</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  全車通過第三方專業鑑定，車況透明無隱瞞，買車最安心。
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <Award className="h-8 w-8 text-primary" />
                <h3 className="text-sm font-bold text-foreground">在地40年老字號</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  高雄在地經營超過40年，正派誠信，口碑深受{area.name}客人信賴。
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <CheckCircle className="h-8 w-8 text-primary" />
                <h3 className="text-sm font-bold text-foreground">實車實價</h3>
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
              <h2 className="text-lg font-bold text-foreground">崑家汽車在售車款</h2>
              {!isLoading && vehicles && (
                <p className="mt-1 text-sm text-muted-foreground">
                  共 <span className="font-semibold text-foreground">{vehicles.length}</span> 台精選二手車等您來看
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
              <p className="mt-1 text-sm">請稍後再來，或聯繫我們了解最新車況</p>
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
                <VehicleListCard key={v.id} vehicle={v} />
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
              {isLocal ? `${area.name}鄉親，歡迎來店看車！` : `${area.name}鄉親，歡迎預約看車！`}
            </h2>
            <p className="mt-2 text-sm text-white/70 max-w-md mx-auto">
              {isLocal
                ? "第三方認證、超強貸款方案、最快3小時交車，歡迎直接到店或LINE預約。"
                : "免費高鐵接送、第三方認證、超強貸款方案，崑家汽車讓您買車安心又輕鬆。"
              }
            </p>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-6 py-3 text-sm font-bold text-white hover:bg-[#05b04c] active:bg-[#049a43] transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE 立即預約看車
            </a>
          </div>
        </section>

        {/* Internal links */}
        <div className="rounded-xl border bg-muted/30 p-6">
          <h2 className="text-sm font-bold mb-4">其他服務地區</h2>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">高雄在地</p>
              {LOCAL_AREAS.filter(a => a.slug !== citySlug).map(a => (
                <a key={a.slug} href={`/area/${a.slug}`} className="block text-xs text-primary hover:underline mb-1">
                  {a.name}二手車推薦
                </a>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">外縣市服務</p>
              {OUT_OF_CITY_AREAS.filter(a => a.slug !== citySlug).map(a => (
                <a key={a.slug} href={`/area/${a.slug}`} className="block text-xs text-primary hover:underline mb-1">
                  {a.name}二手車推薦
                </a>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">依預算找車</p>
              <a href="/price/under-30" className="block text-xs text-primary hover:underline mb-1">30萬以下二手車</a>
              <a href="/price/30-50" className="block text-xs text-primary hover:underline mb-1">30-50萬二手車</a>
              <a href="/price/50-80" className="block text-xs text-primary hover:underline mb-1">50-80萬二手車</a>
              <a href="/price/over-80" className="block text-xs text-primary hover:underline mb-1">80萬以上二手車</a>
              <a href="/blog" className="block text-xs text-primary hover:underline mb-1">購車攻略文章</a>
              <a href="/faq" className="block text-xs text-primary hover:underline mb-1">常見問題 FAQ</a>
            </div>
          </div>
        </div>
      </main>

      <SeoFooter />
      <StickyBookingBar />
    </div>
  );
}
