import { useEffect, useState, useMemo, lazy, Suspense } from "react";
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
  Expand,
  Camera,
  Video,
  RotateCw,
} from "lucide-react";
import StickyBookingBar from "@/components/StickyBookingBar";
import { ViewingNow } from "@/components/SocialProof";
import ProactiveChatTrigger from "@/components/ProactiveChatTrigger";
import WishlistButton from "@/components/WishlistButton";

const FullscreenGallery = lazy(() => import("@/components/FullscreenGallery"));
const Vehicle360Viewer = lazy(() => import("@/components/Vehicle360Viewer"));

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

/** Extract YouTube video ID from various YouTube URL formats */
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function VehicleLanding() {
  const [, params] = useRoute("/vehicle/:id");
  const vehicleId = params?.id ? parseInt(params.id, 10) : null;
  const device = useMemo(() => detectDevice(), []);

  const { data: vehicle, isLoading, error } = trpc.vehicle.getById.useQuery(
    { id: vehicleId! },
    { enabled: vehicleId !== null && !isNaN(vehicleId) }
  );

  const isSold = vehicle?.status === "sold" || vehicle?.status === "reserved";

  // Fetch similar vehicles when this one is sold (must be before early returns)
  const { data: allVehicles } = trpc.vehicle.list.useQuery(undefined, {
    enabled: !!isSold,
  });

  const photos = useMemo(() => {
    if (!vehicle?.photoUrls) return [];
    const raw = vehicle.photoUrls as string;
    if (raw.startsWith("[")) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return raw.split("|").filter((url: string) => url.trim());
  }, [vehicle?.photoUrls]);

  // Parse video URL
  const videoUrl = vehicle?.videoUrl as string | null | undefined;
  const hasVideo = !!videoUrl?.trim();

  // Parse 360 photos (pipe-separated)
  const photos360 = useMemo(() => {
    if (!vehicle?.photos360Urls) return [];
    const raw = vehicle.photos360Urls as string;
    return raw.split("|").filter((url: string) => url.trim());
  }, [vehicle?.photos360Urls]);
  const has360 = photos360.length > 0;

  // Media tab state
  type MediaTab = "photos" | "video" | "360";
  const [activeMediaTab, setActiveMediaTab] = useState<MediaTab>("photos");

  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const totalPhotos = photos.length;

  const similarVehicles = useMemo(() => {
    if (!isSold || !allVehicles || !vehicle) return [];
    return allVehicles
      .filter((v: any) => v.id !== vehicle.id && v.brand === vehicle.brand)
      .slice(0, 3);
  }, [isSold, allVehicles, vehicle]);

  const otherVehicles = useMemo(() => {
    if (!isSold || !allVehicles || !vehicle || similarVehicles.length >= 3) return [];
    const similarIds = new Set(similarVehicles.map((v: any) => v.id));
    return allVehicles
      .filter((v: any) => v.id !== vehicle.id && !similarIds.has(v.id))
      .slice(0, 3 - similarVehicles.length);
  }, [isSold, allVehicles, vehicle, similarVehicles]);

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

  // Sold vehicle → show sold overlay + recommendations
  if (isSold) {
    const recommendations = [...similarVehicles, ...otherVehicles];
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1B3A5C] via-[#1B3A5C] to-[#0f2440]">
        <div className="relative max-w-lg mx-auto px-4 py-6">
          <div className="text-center mb-4">
            <p className="text-[#C4A265] text-xs font-medium tracking-widest uppercase">崑家汽車 · 40年老口碑</p>
          </div>

          {/* Sold banner */}
          <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-4">
            {/* Show first photo with sold overlay */}
            <div className="relative aspect-[16/10] bg-black/30 overflow-hidden">
              {photos.length > 0 ? (
                <ProgressiveImage
                  src={photos[0]}
                  alt={`${name} - 已售出`}
                  containerClassName="w-full h-full opacity-50"
                  aspectRatio="16/10"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Car className="w-16 h-16 text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="bg-red-600/90 px-6 py-2.5 rounded-xl text-white font-bold text-lg shadow-lg">
                  已售出
                </div>
              </div>
            </div>

            <div className="px-5 py-4 text-center">
              <h1 className="text-white text-xl font-bold mb-1">{name}</h1>
              <p className="text-white/40 text-xs mb-3">{year} · {price}</p>
              <p className="text-white/60 text-sm">
                這台車已經找到新主人了！
                {recommendations.length > 0 ? "看看下面其他在售車輛：" : ""}
              </p>
            </div>
          </div>

          {/* Recommend similar vehicles */}
          {recommendations.length > 0 && (
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-4">
              <div className="px-5 py-4">
                <p className="text-white font-bold text-base mb-3">
                  {similarVehicles.length > 0 ? `其他 ${vehicle.brand} 在售車輛` : "推薦在售車輛"}
                </p>
                <div className="space-y-3">
                  {recommendations.map((v: any) => {
                    const vPhoto = v.photoUrls ? String(v.photoUrls).split("|")[0]?.trim() : "";
                    const vPrice = v.priceDisplay || `${v.price}萬`;
                    return (
                      <a
                        key={v.id}
                        href={`/vehicle/${v.id}`}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-all"
                      >
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-black/20 flex-shrink-0">
                          {vPhoto ? (
                            <img src={vPhoto} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Car className="w-6 h-6 text-white/20" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{v.brand} {v.model}</p>
                          <p className="text-white/40 text-xs">{v.modelYear ? `${v.modelYear}年` : ""} · {v.mileage || ""}</p>
                        </div>
                        <div className="text-[#C4A265] font-bold text-sm flex-shrink-0">{vPrice}</div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CTA to browse all */}
          <div className="text-center">
            <a
              href="/"
              className="inline-block px-6 py-3 bg-[#C4A265] text-white rounded-xl font-medium hover:bg-[#a8893e] transition-colors mb-4"
            >
              瀏覽所有在售車輛
            </a>
            <p className="text-white/25 text-xs">崑家汽車 · 高雄市三民區大順二路269號</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B3A5C] via-[#1B3A5C] to-[#0f2440]">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-40 h-40 sm:w-64 sm:h-64 bg-[#C4A265]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[15%] right-[10%] w-48 h-48 sm:w-80 sm:h-80 bg-[#C4A265]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6">
        {/* Breadcrumb nav — visible to crawlers and screen readers */}
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1 text-[10px] text-white/40 flex-wrap">
            <li><a href="/" className="hover:text-white/70 transition-colors">首頁</a></li>
            <li aria-hidden="true" className="text-white/20">/</li>
            <li><a href={`/?brand=${encodeURIComponent(vehicle.brand)}`} className="hover:text-white/70 transition-colors">{vehicle.brand} 二手車</a></li>
            <li aria-hidden="true" className="text-white/20">/</li>
            <li aria-current="page" className="text-white/60 truncate max-w-[140px]">{name} {year}</li>
          </ol>
        </nav>

        {/* Brand header */}
        <div className="text-center mb-4">
          <p className="text-[#C4A265] text-xs font-medium tracking-widest uppercase">崑家汽車 · 40年老口碑</p>
        </div>

        {/* Vehicle card */}
        <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-4">
          {/* Media tabs (only show if multiple media types) */}
          {(hasVideo || has360) && (
            <div className="flex items-center gap-1 px-4 pt-3 pb-1">
              <button
                onClick={() => setActiveMediaTab("photos")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeMediaTab === "photos"
                    ? "bg-[#C4A265]/20 text-[#C4A265] border border-[#C4A265]/30"
                    : "bg-white/[0.06] text-white/50 border border-white/10 hover:bg-white/[0.1]"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                照片
              </button>
              {hasVideo && (
                <button
                  onClick={() => setActiveMediaTab("video")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeMediaTab === "video"
                      ? "bg-[#C4A265]/20 text-[#C4A265] border border-[#C4A265]/30"
                      : "bg-white/[0.06] text-white/50 border border-white/10 hover:bg-white/[0.1]"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  影片
                </button>
              )}
              {has360 && (
                <button
                  onClick={() => setActiveMediaTab("360")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeMediaTab === "360"
                      ? "bg-[#C4A265]/20 text-[#C4A265] border border-[#C4A265]/30"
                      : "bg-white/[0.06] text-white/50 border border-white/10 hover:bg-white/[0.1]"
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  360°
                </button>
              )}
            </div>
          )}

          {/* Media content area */}
          {activeMediaTab === "photos" && (
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

              {/* Wishlist button */}
              <WishlistButton
                vehicle={{
                  id: vehicle.id,
                  brand: vehicle.brand,
                  model: vehicle.model,
                  price,
                  photo: photos[0],
                }}
                size="md"
                className="absolute bottom-3 left-3"
              />

              {/* Fullscreen expand button */}
              {photos.length > 0 && (
                <button
                  onClick={() => setGalleryOpen(true)}
                  className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                  aria-label="全螢幕瀏覽照片"
                >
                  <Expand className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Video tab */}
          {activeMediaTab === "video" && hasVideo && (
            <div className="relative aspect-[16/10] bg-black/30 overflow-hidden">
              {(() => {
                const ytId = getYouTubeId(videoUrl!);
                if (ytId) {
                  return (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0`}
                      title={`${name} 影片`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                return (
                  <video
                    src={videoUrl!}
                    controls
                    className="w-full h-full object-contain bg-black"
                    preload="metadata"
                  >
                    <track kind="captions" />
                  </video>
                );
              })()}
              {/* Price badge */}
              <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#C4A265] to-[#a8893e] text-white font-bold text-lg shadow-lg pointer-events-none">
                {price}
              </div>
            </div>
          )}

          {/* 360 tab */}
          {activeMediaTab === "360" && has360 && (
            <Suspense
              fallback={
                <div className="aspect-[16/10] bg-black/30 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[#C4A265] border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <Vehicle360Viewer photos={photos360} alt={name} />
            </Suspense>
          )}

          {/* Vehicle info */}
          <div className="px-5 py-4">
            <h1 className="text-white text-xl font-bold mb-1">{name}</h1>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-white/40 text-xs">{year} · {vehicle.displacement || ""} · {vehicle.location || "高雄"}</p>
              {vehicleId && <ViewingNow vehicleId={vehicleId} className="text-green-400/80" />}
            </div>

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
          <div className="flex items-center justify-between flex-wrap gap-y-1 text-xs text-white/40">
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

      <StickyBookingBar vehicleId={vehicleId ?? undefined} vehicleName={vehicle ? `${vehicle.brand} ${vehicle.model}` : undefined} />

      {/* Proactive chat nudge after 15s */}
      <ProactiveChatTrigger vehicleName={name} delay={15000} />

      {/* Fullscreen Gallery */}
      {galleryOpen && photos.length > 0 && (
        <Suspense fallback={null}>
          <FullscreenGallery
            photos={photos}
            initialIndex={currentPhoto}
            alt={name}
            onClose={() => setGalleryOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
