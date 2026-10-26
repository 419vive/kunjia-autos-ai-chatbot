import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { addRecentlyViewed } from "@/lib/recentlyViewed";
import {
  Car,
  ArrowRight,
  Phone,
  ChevronLeft,
  ChevronRight,
  Shield,
  Expand,
  Camera,
  Video,
  RotateCw,
  CheckCircle,
  Cog,
} from "lucide-react";
import StickyBookingBar from "@/components/StickyBookingBar";
import ProactiveChatTrigger from "@/components/ProactiveChatTrigger";
import WishlistButton from "@/components/WishlistButton";
import SeoFooter from "@/components/SeoFooter";

const FullscreenGallery = lazy(() => import("@/components/FullscreenGallery"));
const Vehicle360Viewer = lazy(() => import("@/components/Vehicle360Viewer"));
const VehicleVideoPlayer = lazy(() => import("@/components/VehicleVideoPlayer"));
const VideoShowcaseNudge = lazy(() => import("@/components/VideoShowcaseNudge"));

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
      className: "bg-white/[0.10] border-white/25 text-white",
      lineMessage: `我看到這台 ${name} ${year}，網頁上標 ${price}，有什麼優惠嗎？`,
    },
    {
      id: "visit",
      icon: "🚗",
      label: "我想預約看這台車",
      className: "bg-green-500/10 border-green-500/25 text-green-500",
      lineMessage: `我想預約看這台 ${name} ${year}，什麼時候方便？`,
      bookUrl: true,
    },
    {
      id: "trade",
      icon: "🔄",
      label: "我有舊車想換這台",
      className: "bg-white/[0.10] border-white/25 text-white",
      lineMessage: `我有一台舊車想換這台 ${name} ${year}，可以幫我估價折抵嗎？`,
    },
    {
      id: "loan",
      icon: "💰",
      label: "貸款利率怎麼算？",
      className: "bg-white/[0.10] border-white/25 text-white",
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

  // Fetch similar vehicles for both live and sold vehicles (must be before early returns)
  const { data: allVehiclesData } = trpc.vehicle.list.useQuery(undefined, {
    enabled: vehicleId !== null && !isNaN(vehicleId),
  });
  const allVehicles = allVehiclesData?.items;

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
  type MediaTab = "photos" | "video" | "360" | "showcase";
  // Check URL for ?tab=showcase (from LINE video card deep link)
  const initialTab = useMemo(() => {
    const urlTab = new URLSearchParams(window.location.search).get("tab");
    return urlTab === "showcase" ? "showcase" as MediaTab : "photos" as MediaTab;
  }, []);
  const [activeMediaTab, setActiveMediaTab] = useState<MediaTab>(initialTab);

  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const totalPhotos = photos.length;

  const similarVehicles = useMemo(() => {
    if (!allVehicles || !vehicle) return [];
    return allVehicles
      .filter((v: any) => v.id !== vehicle.id && v.brand === vehicle.brand)
      .slice(0, 3);
  }, [allVehicles, vehicle]);

  const otherVehicles = useMemo(() => {
    if (!allVehicles || !vehicle || similarVehicles.length >= 3) return [];
    const similarIds = new Set(similarVehicles.map((v: any) => v.id));
    return allVehicles
      .filter((v: any) => v.id !== vehicle.id && !similarIds.has(v.id))
      .slice(0, 3 - similarVehicles.length);
  }, [allVehicles, vehicle, similarVehicles]);

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
          <div className="w-10 h-10 border-3 border-white/70 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
            className="inline-block px-6 py-3 bg-white text-[#1B3A5C] rounded-xl font-medium hover:bg-white/90 transition-colors"
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
            <p className="text-white/75 text-xs font-medium tracking-widest uppercase">崑家汽車 · 40年老口碑</p>
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
                        <div className="text-white font-bold text-sm flex-shrink-0 tabular-nums">{vPrice}</div>
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
              className="inline-block px-6 py-3 bg-white text-[#1B3A5C] rounded-xl font-medium hover:bg-white/90 transition-colors mb-4"
            >
              瀏覽所有在售車輛
            </a>
            <p className="text-white/25 text-xs">崑家汽車 · 高雄市三民區大順二路269號</p>
          </div>
        </div>
        {/* P1 SEO fix: render SeoFooter so sold pages aren't navigation dead-ends */}
        <SeoFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B3A5C] via-[#1B3A5C] to-[#0f2440]">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-40 h-40 sm:w-64 sm:h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[15%] right-[10%] w-48 h-48 sm:w-80 sm:h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6">
        {/* Breadcrumb nav — visible to crawlers and screen readers */}
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1 text-[10px] text-white/40 flex-wrap">
            <li><a href="/" className="hover:text-white/70 transition-colors">首頁</a></li>
            <li aria-hidden="true" className="text-white/20">/</li>
            <li><a href={`/brand/${encodeURIComponent(vehicle.brand)}`} className="hover:text-white/70 transition-colors">{vehicle.brand} 二手車</a></li>
            <li aria-hidden="true" className="text-white/20">/</li>
            <li aria-current="page" className="text-white/60 truncate max-w-[140px]">{name} {year}</li>
          </ol>
        </nav>

        {/* Brand header */}
        <div className="text-center mb-4">
          <p className="text-white/75 text-xs font-medium tracking-widest uppercase">崑家汽車 · 40年老口碑</p>
        </div>

        {/* Vehicle card */}
        <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-4">
          {/* Media tabs — always show showcase tab since we generate it */}
          {(hasVideo || has360 || photos.length > 0) && (
            <div className="flex items-center gap-1 px-4 pt-3 pb-1">
              <button
                onClick={() => setActiveMediaTab("photos")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeMediaTab === "photos"
                    ? "bg-white/20 text-white border border-white/35"
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
                      ? "bg-white/20 text-white border border-white/35"
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
                      ? "bg-white/20 text-white border border-white/35"
                      : "bg-white/[0.06] text-white/50 border border-white/10 hover:bg-white/[0.1]"
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  360°
                </button>
              )}
              {photos.length >= 1 && (
                <button
                  onClick={() => setActiveMediaTab("showcase")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeMediaTab === "showcase"
                      ? "bg-white/20 text-white border border-white/35"
                      : "bg-white/[0.06] text-white/50 border border-white/10 hover:bg-white/[0.1]"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  精選影片
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
                    alt={`${vehicle.modelYear ? vehicle.modelYear + '年 ' : ''}${name}${vehicle.color ? ' ' + vehicle.color : ''} 崑家汽車高雄 - 照片 ${currentPhoto + 1}`}
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
              <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-lg shadow-lg">
                {price}
              </div>

              {/* Certification badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#1B3A5C]/80 backdrop-blur border border-white/30 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-xs font-medium">第三方認證</span>
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
              <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-lg shadow-lg pointer-events-none">
                {price}
              </div>
            </div>
          )}

          {/* 360 tab */}
          {activeMediaTab === "360" && has360 && (
            <Suspense
              fallback={
                <div className="aspect-[16/10] bg-black/30 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <Vehicle360Viewer photos={photos360} alt={name} />
            </Suspense>
          )}

          {/* Remotion auto-generated showcase video */}
          {activeMediaTab === "showcase" && photos.length >= 1 && (
            <Suspense
              fallback={
                <div className="aspect-video bg-black/30 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <VehicleVideoPlayer vehicle={vehicle} />
            </Suspense>
          )}

          {/* Vehicle info */}
          <div className="px-5 py-4">
            <h1 className="text-white text-xl font-bold mb-1">{name}</h1>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-white/40 text-xs">{year} · {vehicle.displacement || ""} · {vehicle.location || "高雄"}</p>
            </div>

            {/* Price + new car price comparison */}
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-white text-2xl font-bold tabular-nums">{price}</span>
              {vehicle.newCarPrice && (vehicle.newCarPrice as string).trim() && (
                <span className="text-white/35 text-xs tabular-nums">新車價：<span className="line-through">{vehicle.newCarPrice as string}</span></span>
              )}
            </div>

            {/* Trust line */}
            <p className="flex items-center gap-1 text-green-400 text-xs mb-4">
              🔒 第三方認證 · 實車實價 · 支援貸款
            </p>

            {/* ─── 簡介 section (like 8891) ─── */}
            <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] mb-3 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
                <span className="text-white/50 text-xs font-medium">簡介</span>
              </div>
              <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">{vehicle.location || "高雄市"}</p>
                  <p className="text-white/40 text-[10px]">所在地</p>
                </div>
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium tabular-nums mb-0.5">{vehicle.mileage || "—"}</p>
                  <p className="text-white/40 text-[10px]">里程</p>
                </div>
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">{vehicle.fuelType || "—"}</p>
                  <p className="text-white/40 text-[10px]">引擎燃料</p>
                </div>
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">{vehicle.manufactureYear ? `${vehicle.manufactureYear}年` : year}</p>
                  <p className="text-white/40 text-[10px]">出廠年份</p>
                </div>
              </div>
              {vehicle.licenseDate && (
                <div className="border-t border-white/[0.06] px-4 py-2 flex items-center justify-between">
                  <span className="text-white/40 text-[10px]">領牌日期</span>
                  <span className="text-white/70 text-xs tabular-nums">{vehicle.licenseDate}</span>
                </div>
              )}
            </div>

            {/* ─── 參數 section (like 8891) ─── */}
            <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] mb-3 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
                <Cog className="w-3 h-3 text-white/40" />
                <span className="text-white/50 text-xs font-medium">參數</span>
              </div>
              <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">{vehicle.displacement || "—"}</p>
                  <p className="text-white/40 text-[10px]">排氣量</p>
                </div>
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">{vehicle.transmission || "—"}</p>
                  <p className="text-white/40 text-[10px]">變速系統</p>
                </div>
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">{vehicle.color || "—"}</p>
                  <p className="text-white/40 text-[10px]">車色</p>
                </div>
                <div className="px-2 py-3 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">{vehicle.bodyType || "—"}</p>
                  <p className="text-white/40 text-[10px]">車型</p>
                </div>
              </div>
            </div>

            {/* ─── 亮點 / Features from 8891 ─── */}
            {vehicle.features && (vehicle.features as string).trim() && (
              <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] mb-3 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
                  <span className="text-white/50 text-xs font-medium">亮點配備</span>
                </div>
                <div className="flex flex-wrap gap-1.5 px-4 py-3">
                  {(vehicle.features as string).split(/[、,，/]/).filter(Boolean).map((feat, i) => (
                    <span
                      key={i}
                      className="inline-block px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-white/90 text-xs"
                    >
                      {feat.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ─── 車源說明 / Description ─── */}
            <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] mb-3 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
                <span className="text-white/50 text-xs font-medium">車源說明</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-white/80 text-sm leading-relaxed answer-summary" data-speakable>
                  {vehicle.description
                    ? (vehicle.description as string)
                    : `${year} ${name}，${vehicle.mileage ? `里程 ${vehicle.mileage}，` : ""}${vehicle.fuelType ? `${vehicle.fuelType}，` : ""}全車通過第三方認證，品質保證！`}
                </p>
              </div>
            </div>

            {/* ─── 崑家認證 guarantee checklist ─── */}
            <div className="bg-gradient-to-b from-white/[0.06] to-transparent rounded-xl border border-white/[0.12] mb-3 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.08]">
                <span className="text-white text-xs font-bold">崑家認證車況</span>
                <span className="text-white/40 text-[10px]">真實車況保証，安心購車！</span>
              </div>
              {/* 3 badges */}
              <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                <div className="py-2.5 text-center">
                  <p className="text-white/70 text-xs">已認證</p>
                </div>
                <div className="py-2.5 text-center">
                  <p className="text-white/70 text-xs">無事故</p>
                </div>
                <div className="py-2.5 text-center">
                  <p className="text-white/70 text-xs">完整文件</p>
                </div>
              </div>
              {/* Individual guarantee items — data-driven or fallback */}
              <div className="divide-y divide-white/[0.04]">
                {(vehicle.guarantees && (vehicle.guarantees as string).trim()
                  ? (vehicle.guarantees as string).split(/[、,，/]/).filter(Boolean)
                  : [
                      "無重大事故或車體銜接",
                      "無泡水",
                      "無計程車變造",
                      "無引擎號碼變造",
                      "無車身號碼變造",
                      "引擎本體無異常",
                      "變速箱換檔無異常",
                      "方向機本體無異常",
                      "車輛配備無異常",
                      "提供保固",
                    ]
                ).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2">
                    <span className="text-white/60 text-xs">{item.trim()}</span>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Urgency / social proof line */}
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-3">
              <span className="text-base leading-none">🔥</span>
              <p className="text-orange-400 text-xs font-medium">近期詢問熱烈，建議盡早預約看車</p>
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
                  className={`flex items-center gap-3 w-full p-3.5 rounded-[var(--radius)] border transition-all hover:scale-[1.02] active:scale-[0.98] ${q.className}`}
                >
                  <span className="text-2xl flex-shrink-0">{q.icon}</span>
                  <span className="text-white font-medium text-sm text-left flex-1">
                    {q.label}
                  </span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
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

        {/* Nearby service areas — internal link equity for geo SEO */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] px-4 py-3 mb-4">
          <p className="text-white/40 text-xs mb-2 font-semibold">附近服務地區</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[
              { label: "高雄", href: "/area/kaohsiung" },
              { label: "三民區", href: "/area/kaohsiung-sanmin" },
              { label: "左營區", href: "/area/kaohsiung-zuoying" },
              { label: "鳳山區", href: "/area/kaohsiung-fengshan" },
              { label: "苓雅區", href: "/area/kaohsiung-lingya" },
              { label: "台南", href: "/area/tainan" },
              { label: "屏東", href: "/area/pingtung" },
              { label: "台中", href: "/area/taichung" },
              { label: "嘉義", href: "/area/chiayi" },
            ].map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="text-white/75 text-xs hover:text-white transition-colors"
              >
                {a.label}二手車
              </a>
            ))}
          </div>
        </div>

        {/* Contextual blog links — internal linking for SEO */}
        <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] px-4 py-3 mb-4">
          <p className="text-white/60 text-xs font-semibold mb-2">📖 購車必讀</p>
          <div className="space-y-1.5">
            <a href="/blog/buy-used-car-guide" className="block text-xs text-white/40 hover:text-white/80 transition-colors">買二手車 7 大注意事項</a>
            <a href="/blog/used-car-loan-guide" className="block text-xs text-white/40 hover:text-white/80 transition-colors">二手車貸款全攻略</a>
            <a href="/blog/third-party-inspection-guide" className="block text-xs text-white/40 hover:text-white/80 transition-colors">第三方認證指南</a>
            <a href="/blog/used-car-transfer-guide" className="block text-xs text-white/40 hover:text-white/80 transition-colors">過戶流程與費用</a>
            <a href="/faq" className="block text-xs text-white/40 hover:text-white/80 transition-colors">常見問題 FAQ →</a>
          </div>
        </div>

        {/* Similar vehicle recommendations */}
        {(similarVehicles.length > 0 || otherVehicles.length > 0) && (
          <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-4">
            <div className="px-5 py-4">
              <p className="text-white font-bold text-base mb-3">
                看了這台也看看
              </p>
              <div className="space-y-3">
                {[...similarVehicles, ...otherVehicles].map((v: any) => {
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
                      <div className="text-white font-bold text-sm flex-shrink-0">{vPrice}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-white/25 text-xs">
            崑家汽車 · 高雄市三民區大順二路269號
          </p>
          <a href="/" className="text-white/75 text-xs hover:text-white transition-colors">
            ← 瀏覽所有車輛
          </a>
        </div>
      </div>

      <StickyBookingBar vehicleId={vehicleId ?? undefined} vehicleName={vehicle ? `${vehicle.brand} ${vehicle.model}` : undefined} />

      {/* Proactive chat nudge after 15s */}
      <ProactiveChatTrigger vehicleName={name} delay={15000} />

      {/* Video showcase nudge after 20s of browsing */}
      {photos.length >= 1 && (
        <Suspense fallback={null}>
          <VideoShowcaseNudge
            vehicleName={name}
            delay={20000}
            onWatchClick={() => setActiveMediaTab("showcase")}
          />
        </Suspense>
      )}

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

      {/* P1 SEO fix: SeoFooter was imported but never rendered on live vehicle pages —
          every car detail page was a navigation dead-end. Added 2026-04-21. */}
      <SeoFooter />
    </div>
  );
}
