import { useEffect, useState, useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { addRecentlyViewed } from "@/lib/recentlyViewed";
import {
  Car,
  MapPin,
  Fuel,
  Gauge,
  Calendar,
  ArrowRight,
  Phone,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import StickyBookingBar from "@/components/StickyBookingBar";

type DeviceType = "mobile" | "desktop";

function detectDevice(): DeviceType {
  const ua = navigator.userAgent || "";
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  ) {
    return "mobile";
  }
  return "desktop";
}

const LINE_OA_URL = "https://page.line.me/825oftez";

// 3 intent-detection questions — designed to qualify customer intent
function getIntentQuestions(vehicle: any) {
  const name = `${vehicle.brand} ${vehicle.model}`;
  const year = vehicle.modelYear ? `${vehicle.modelYear}年` : "";
  const price = vehicle.priceDisplay || `${vehicle.price}萬`;

  return [
    {
      id: "price",
      icon: "💰",
      label: "這台多少錢？有優惠嗎？",
      color: "#C4A265",
      bgColor: "rgba(196, 162, 101, 0.1)",
      borderColor: "rgba(196, 162, 101, 0.25)",
      lineMessage: `我看到這台 ${name} ${year}，網頁上標 ${price}，有什麼優惠嗎？`,
    },
    {
      id: "visit",
      icon: "🚗",
      label: "我想預約看這台車",
      color: "#06C755",
      bgColor: "rgba(6, 199, 85, 0.1)",
      borderColor: "rgba(6, 199, 85, 0.25)",
      lineMessage: `我想預約看這台 ${name} ${year}，什麼時候方便？`,
      bookUrl: true,
    },
    {
      id: "trade",
      icon: "🔄",
      label: "我有舊車想換這台",
      color: "#9B59B6",
      bgColor: "rgba(155, 89, 182, 0.1)",
      borderColor: "rgba(155, 89, 182, 0.25)",
      lineMessage: `我有一台舊車想換這台 ${name} ${year}，可以幫我估價折抵嗎？`,
    },
    {
      id: "loan",
      icon: "💰",
      label: "貸款利率怎麼算？",
      color: "#E67E22",
      bgColor: "rgba(230, 126, 34, 0.1)",
      borderColor: "rgba(230, 126, 34, 0.25)",
      lineMessage: "",
      loanUrl: true,
    },
  ];
}

function buildLineDeepLink(message: string): string {
  // LINE OA chat with pre-filled text
  // Use the LINE URL scheme to open chat
  const encoded = encodeURIComponent(message);
  // On mobile: open LINE app directly with OA
  // We'll redirect to LINE OA page and the user sends their pre-filled message
  return `${LINE_OA_URL}?openQrModal=1&body=${encoded}`;
}

export default function VehicleLanding() {
  const [, params] = useRoute("/vehicle/:id");
  const vehicleId = params?.id ? parseInt(params.id, 10) : null;
  const device = useMemo(() => detectDevice(), []);

  const { data: vehicle, isLoading, error } = trpc.vehicle.getById.useQuery(
    { id: vehicleId! },
    { enabled: vehicleId !== null && !isNaN(vehicleId) }
  );

  const photos = useMemo(() => {
    if (!vehicle?.photoUrls) return [];
    const raw = vehicle.photoUrls as string;
    if (raw.startsWith("[")) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return raw.split("|").filter((url: string) => url.trim());
  }, [vehicle?.photoUrls]);

  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const totalPhotos = photos.length;

  // Touch swipe for photo gallery
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) >= 50) {
      if (distance > 0 && totalPhotos > 1) {
        setCurrentPhoto((prev) => (prev + 1) % totalPhotos);
      } else if (distance < 0 && totalPhotos > 1) {
        setCurrentPhoto((prev) => (prev - 1 + totalPhotos) % totalPhotos);
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Set page title for OG preview + track recently viewed
  useEffect(() => {
    if (vehicle) {
      document.title = `${vehicle.brand} ${vehicle.model} ${vehicle.modelYear || ""}年 ${vehicle.priceDisplay || vehicle.price + "萬"} | 崑家汽車`;
      const photoList = vehicle.photoUrls ? String(vehicle.photoUrls).split("|").filter((u: string) => u.trim()) : [];
      addRecentlyViewed({
        id: vehicle.id,
        brand: vehicle.brand,
        model: vehicle.model,
        price: vehicle.priceDisplay || `${vehicle.price}萬`,
        photo: photoList[0] || undefined,
      });
    }
  }, [vehicle]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1B3A5C] to-[#0f2440] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#C4A265] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">載入車輛資訊中...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1B3A5C] to-[#0f2440] flex items-center justify-center p-4">
        <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 p-8 max-w-md w-full text-center">
          <Car className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">找不到這台車</h2>
          <p className="text-white/50 text-sm mb-6">這台車可能已售出或連結有誤</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-[#C4A265] text-white rounded-xl font-medium hover:bg-[#a8893e] transition-colors"
          >
            瀏覽所有車輛
          </a>
        </div>
      </div>
    );
  }

  const name = `${vehicle.brand} ${vehicle.model}`;
  const year = vehicle.modelYear ? `${vehicle.modelYear}年` : "";
  const price = vehicle.priceDisplay || `${vehicle.price}萬`;
  const questions = getIntentQuestions(vehicle);

  // Build specs
  const specs: { icon: React.ReactNode; text: string }[] = [];
  if (vehicle.modelYear) specs.push({ icon: <Calendar className="w-3.5 h-3.5" />, text: `${vehicle.modelYear}年` });
  if (vehicle.mileage) specs.push({ icon: <Gauge className="w-3.5 h-3.5" />, text: vehicle.mileage });
  if (vehicle.fuelType) specs.push({ icon: <Fuel className="w-3.5 h-3.5" />, text: vehicle.fuelType });
  if (vehicle.color) specs.push({ icon: <Car className="w-3.5 h-3.5" />, text: vehicle.color });
  if (vehicle.transmission) specs.push({ icon: <Gauge className="w-3.5 h-3.5" />, text: vehicle.transmission });

  const handleQuestionClick = (question: ReturnType<typeof getIntentQuestions>[number]) => {
    // Loan inquiry → redirect to form page
    if ((question as any).loanUrl) {
      window.location.href = `/loan-inquiry?vehicleId=${vehicle.id}&vehicle=${encodeURIComponent(name)}`;
      return;
    }
    // Appointment booking → redirect to booking form
    if ((question as any).bookUrl) {
      window.location.href = `/book-visit?vehicleId=${vehicle.id}&vehicle=${encodeURIComponent(name)}`;
      return;
    }
    if (device === "mobile") {
      // Mobile → open LINE OA with pre-filled message
      window.location.href = buildLineDeepLink(question.lineMessage);
    } else {
      // Desktop → go to website chat with vehicle context
      const chatUrl = `/chat?vehicle=${encodeURIComponent(name)}&message=${encodeURIComponent(question.lineMessage)}`;
      window.location.href = chatUrl;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B3A5C] via-[#1B3A5C] to-[#0f2440]">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-[#C4A265]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 bg-[#C4A265]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6">
        {/* Brand header */}
        <div className="text-center mb-4">
          <p className="text-[#C4A265] text-xs font-medium tracking-widest uppercase">崑家汽車 · 40年老口碑</p>
        </div>

        {/* Vehicle card */}
        <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-4">
          {/* Photo */}
          <div
            className="relative aspect-[16/10] bg-black/30 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {photos.length > 0 ? (
              <>
                <ProgressiveImage
                  src={photos[currentPhoto]}
                  alt={`${name} - 照片 ${currentPhoto + 1}`}
                  containerClassName="w-full h-full"
                  aspectRatio="16/10"
                />
                {totalPhotos > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentPhoto((p) => (p - 1 + totalPhotos) % totalPhotos)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPhoto((p) => (p + 1) % totalPhotos)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white text-xs">
                      {currentPhoto + 1} / {totalPhotos}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Car className="w-16 h-16 text-white/20" />
              </div>
            )}

            {/* Price badge */}
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#C4A265] to-[#a8893e] text-white font-bold text-lg shadow-lg">
              {price}
            </div>

            {/* Certification badge */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#1B3A5C]/80 backdrop-blur border border-[#C4A265]/30 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#C4A265]" />
              <span className="text-[#C4A265] text-xs font-medium">第三方認證</span>
            </div>
          </div>

          {/* Vehicle info */}
          <div className="px-5 py-4">
            <h1 className="text-white text-xl font-bold mb-1">{name}</h1>
            <p className="text-white/40 text-xs mb-2">{year} · {vehicle.displacement || ""} · {vehicle.location || "高雄"}</p>

            {/* Trust line — below title/price area */}
            <p className="flex items-center gap-1 text-green-400 text-xs mb-3">
              🔒 第三方認證 · 實車實價 · 支援貸款
            </p>

            {/* Specs grid */}
            <div className="flex flex-wrap gap-2 mb-3">
              {specs.map((spec, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 text-xs"
                >
                  {spec.icon}
                  {spec.text}
                </div>
              ))}
            </div>

            {/* Urgency / social proof line */}
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-3">
              <span className="text-base leading-none">🔥</span>
              <p className="text-orange-400 text-xs font-medium">近期詢問熱烈，建議盡早預約看車</p>
            </div>

            {/* Short compelling copy */}
            <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] px-4 py-3">
              <p className="text-white/80 text-sm leading-relaxed">
                {vehicle.description
                  ? (vehicle.description as string).slice(0, 120) + ((vehicle.description as string).length > 120 ? "..." : "")
                  : `${year} ${name}，${vehicle.mileage ? `里程 ${vehicle.mileage}，` : ""}${vehicle.fuelType ? `${vehicle.fuelType}，` : ""}全車通過第三方認證，品質保證！`}
              </p>
            </div>
          </div>
        </div>

        {/* Intent detection questions — the core progressive element */}
        <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-4">
          <div className="px-5 py-4">
            <p className="text-white font-bold text-base mb-1">
              對這台車有興趣？👇
            </p>
            <p className="text-white/40 text-xs mb-4">
              選一個最符合你的需求，{device === "mobile" ? "阿家在 LINE 上馬上回覆你" : "阿家線上馬上回覆你"}！
            </p>

            <div className="space-y-2.5">
              {questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => handleQuestionClick(q)}
                  className="flex items-center gap-3 w-full p-3.5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: q.bgColor,
                    borderColor: q.borderColor,
                  }}
                >
                  <span className="text-2xl flex-shrink-0">{q.icon}</span>
                  <span className="text-white font-medium text-sm text-left flex-1">
                    {q.label}
                  </span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: q.color }} />
                </button>
              ))}
            </div>
          </div>

          {/* Direct call fallback */}
          <div className="px-5 pb-4">
            <a
              href="tel:0936812818"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/10 transition-all text-white/50 text-xs"
            >
              <Phone className="w-3.5 h-3.5" />
              或直接打電話 0936-812-818
            </a>
          </div>
        </div>

        {/* Trust badges — mini version of 5 guarantees */}
        <div className="bg-white/[0.05] rounded-2xl border border-white/[0.06] px-4 py-3 mb-4">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>🛡️ 第三方認證</span>
            <span>💰 超強貸款</span>
            <span>🚗 免費接駁</span>
            <span>⚡ 快速交車</span>
            <span>🔄 高價收購</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-white/25 text-xs">
            崑家汽車 · 高雄市三民區大順二路269號
          </p>
          <a href="/" className="text-[#C4A265]/60 text-xs hover:text-[#C4A265] transition-colors">
            ← 瀏覽所有車輛
          </a>
        </div>
      </div>

      <StickyBookingBar />
    </div>
  );
}
