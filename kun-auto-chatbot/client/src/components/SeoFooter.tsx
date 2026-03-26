import { MapPin, Shield, Clock } from "lucide-react";

const LINE_OA_URL = "https://page.line.me/825oftez";

const PRICE_RANGES = [
  { label: "30萬以下", href: "/price/under-30" },
  { label: "30-50萬", href: "/price/30-50" },
  { label: "50-80萬", href: "/price/50-80" },
  { label: "80萬以上", href: "/price/over-80" },
];

const POPULAR_BRANDS = [
  "Toyota", "Honda", "BMW", "Benz", "Mazda", "Nissan",
  "Ford", "Volkswagen", "Mitsubishi", "Lexus",
];

const BLOG_LINKS = [
  { label: "買二手車7大注意事項", href: "/blog/buy-used-car-guide" },
  { label: "二手車貸款全攻略", href: "/blog/used-car-loan-guide" },
  { label: "高雄二手車推薦", href: "/blog/kaohsiung-used-car-guide" },
  { label: "第三方認證指南", href: "/blog/third-party-inspection-guide" },
  { label: "過戶流程與費用", href: "/blog/used-car-transfer-guide" },
  { label: "高雄二手車行推薦比較 2026", href: "/blog/kaohsiung-used-car-dealers-comparison" },
];

const SERVICE_AREAS = [
  { label: "台南二手車", href: "/area/tainan" },
  { label: "屏東二手車", href: "/area/pingtung" },
  { label: "台中二手車", href: "/area/taichung" },
  { label: "嘉義二手車", href: "/area/chiayi" },
];

export default function SeoFooter() {
  return (
    <footer className="bg-[#1e2a38] text-white/80">
      {/* Main footer grid */}
      <div className="container py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: About */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">崑家汽車</h3>
            <p className="text-xs leading-relaxed text-white/60 mb-4">
              高雄在地40年二手車行，正派經營。全車第三方認證、超強貸款方案，是您買二手車最值得信賴的選擇。
            </p>
            <div className="space-y-2 text-xs text-white/60">
              <a
                href="https://maps.google.com/?q=高雄市三民區大順二路269號"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <MapPin className="h-3 w-3 shrink-0" />
                高雄市三民區大順二路269號
              </a>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 shrink-0" />
                週一至週六 09:00-21:00
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 shrink-0" />
                全車第三方認證
              </div>
            </div>
            {/* LINE CTA */}
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 text-xs font-semibold text-white hover:bg-[#05b04c] transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE 加好友 @825oftez
            </a>
          </div>

          {/* Column 2: Price ranges */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">依預算找車</h3>
            <ul className="space-y-2">
              {PRICE_RANGES.map((r) => (
                <li key={r.href}>
                  <a
                    href={r.href}
                    className="text-xs text-white/60 hover:text-white transition-colors"
                  >
                    {r.label} 二手車
                  </a>
                </li>
              ))}
            </ul>
            <h3 className="text-sm font-bold text-white mt-6 mb-3">快速連結</h3>
            <ul className="space-y-2">
              <li>
                <a href="/" className="text-xs text-white/60 hover:text-white transition-colors">
                  全部在售車輛
                </a>
              </li>
              <li>
                <a href="/blog" className="text-xs text-white/60 hover:text-white transition-colors">
                  購車攻略
                </a>
              </li>
              <li>
                <a href="/faq" className="text-xs text-white/60 hover:text-white transition-colors">
                  常見問題 FAQ
                </a>
              </li>
            </ul>
            <h3 className="text-sm font-bold text-white mt-6 mb-3">服務地區</h3>
            <ul className="space-y-2">
              {SERVICE_AREAS.map((area) => (
                <li key={area.href}>
                  <a
                    href={area.href}
                    className="text-xs text-white/60 hover:text-white transition-colors"
                  >
                    {area.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Brands */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">依品牌找車</h3>
            <ul className="space-y-2">
              {POPULAR_BRANDS.map((brand) => (
                <li key={brand}>
                  <a
                    href={`/brand/${encodeURIComponent(brand)}`}
                    className="text-xs text-white/60 hover:text-white transition-colors"
                  >
                    {brand} 二手車
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Blog articles */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">購車攻略</h3>
            <ul className="space-y-2">
              {BLOG_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-xs text-white/60 hover:text-white transition-colors leading-relaxed"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <h3 className="text-sm font-bold text-white mt-6 mb-3">服務保障</h3>
            <ul className="space-y-1.5 text-xs text-white/60">
              <li>全車第三方認證</li>
              <li>超強貸款團隊</li>
              <li>外縣市免費接駁</li>
              <li>最快3小時交車</li>
              <li>舊車高價收購</li>
              <li>歡迎攜帶驗車師傅</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-white/40">
          <p>&copy; {new Date().getFullYear()} 崑家汽車 KUN MOTORS. 高雄市三民區大順二路269號</p>
          <p>高雄在地 40 年老口碑 · 正派經營</p>
        </div>
      </div>
    </footer>
  );
}
