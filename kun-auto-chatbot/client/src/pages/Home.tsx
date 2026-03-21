import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, MessageCircle, MapPin, Fuel, Gauge, Calendar, Search, ChevronLeft, ChevronRight, Shield, X, ExternalLink, GitCompareArrows, Expand } from "lucide-react";
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { useCompareList, CompareBar } from "@/components/VehicleCompare";
import { getRecentlyViewed, type RecentlyViewedItem } from "@/lib/recentlyViewed";
import SeoFooter from "@/components/SeoFooter";
import StickyBookingBar from "@/components/StickyBookingBar";
import WelcomeBack from "@/components/WelcomeBack";
import WishlistButton from "@/components/WishlistButton";
import WishlistDrawer from "@/components/WishlistDrawer";
import { TodayActivity } from "@/components/SocialProof";
import { useScrollReveal, revealClass, staggerDelay } from "@/hooks/useScrollReveal";
import { nanoid } from "nanoid";

const FullscreenGallery = lazy(() => import("@/components/FullscreenGallery"));

function VehicleCard({ vehicle, isComparing, onToggleCompare, onOpenGallery }: { vehicle: any; isComparing: boolean; onToggleCompare: () => void; onOpenGallery?: (photos: string[], index: number, alt: string) => void }) {
  const [, setLocation] = useLocation();
  const photos = useMemo(() => {
    if (!vehicle.photoUrls) return [];
    return vehicle.photoUrls.split("|").filter((url: string) => url.trim());
  }, [vehicle.photoUrls]);

  const featureList = useMemo(() => {
    if (!vehicle.features) return [];
    return vehicle.features.split(",").map((f: string) => f.trim()).filter(Boolean);
  }, [vehicle.features]);

  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const totalPhotos = photos.length;

  const goNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos > 1) {
      setCurrentPhoto((prev) => (prev + 1) % totalPhotos);
    }
  }, [totalPhotos]);

  const goPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos > 1) {
      setCurrentPhoto((prev) => (prev - 1 + totalPhotos) % totalPhotos);
    }
  }, [totalPhotos]);

  // Touch swipe handlers
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
    const minSwipe = 50;
    if (Math.abs(distance) >= minSwipe) {
      if (distance > 0 && totalPhotos > 1) {
        // Swipe left → next
        setCurrentPhoto((prev) => (prev + 1) % totalPhotos);
      } else if (distance < 0 && totalPhotos > 1) {
        // Swipe right → prev
        setCurrentPhoto((prev) => (prev - 1 + totalPhotos) % totalPhotos);
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div
        className="relative aspect-[16/10] overflow-hidden bg-muted"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {photos.length > 0 ? (
          <>
            <ProgressiveImage
              src={photos[currentPhoto]}
              alt={`${vehicle.brand} ${vehicle.model} - 照片 ${currentPhoto + 1}`}
              className="transition-transform group-hover:scale-105"
              containerClassName="h-full w-full"
              aspectRatio="16/10"
            />
            {/* Navigation arrows - only show if multiple photos */}
            {totalPhotos > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white shadow-md hover:bg-black/70 active:bg-black/80 transition-colors"
                  aria-label="上一張"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white shadow-md hover:bg-black/70 active:bg-black/80 transition-colors"
                  aria-label="下一張"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {/* Dot indicators */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  {totalPhotos <= 10 ? (
                    photos.map((_: string, i: number) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setCurrentPhoto(i); }}
                        className={`h-1.5 rounded-full transition-all ${
                          i === currentPhoto
                            ? "w-4 bg-white"
                            : "w-1.5 bg-white/50 hover:bg-white/70"
                        }`}
                        aria-label={`照片 ${i + 1}`}
                      />
                    ))
                  ) : (
                    <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                      {currentPhoto + 1} / {totalPhotos}
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Car className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs">
          {vehicle.status === "available" ? "在售" : vehicle.status === "reserved" ? "已預訂" : "已售出"}
        </Badge>
        {/* Scarcity / social proof badges */}
        {(() => {
          const isNew = vehicle.createdAt
            ? Date.now() - new Date(vehicle.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
            : false;
          const isHot = Number(vehicle.price) < 50;
          if (!isNew && !isHot) return null;
          return (
            <div className="absolute top-8 left-2 flex flex-col gap-1">
              {isNew && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500 text-white leading-none">
                  本週新到
                </span>
              )}
              {isHot && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-orange-500 text-white leading-none">
                  詢問熱烈
                </span>
              )}
            </div>
          );
        })()}
        {/* Photo count + expand + wishlist */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {vehicle.status === "available" && (
            <WishlistButton
              vehicle={{
                id: vehicle.id,
                brand: vehicle.brand,
                model: vehicle.model,
                price: vehicle.priceDisplay || `${vehicle.price}萬`,
                photo: photos[0],
              }}
              size="sm"
            />
          )}
          {totalPhotos > 1 && (
            <span className="flex items-center gap-0.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
              📷 {totalPhotos}
            </span>
          )}
          {photos.length > 0 && onOpenGallery && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenGallery(photos, currentPhoto, `${vehicle.brand} ${vehicle.model}`); }}
              className="flex items-center justify-center w-6 h-6 rounded bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="全螢幕瀏覽"
            >
              <Expand className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-start gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
              className={`mt-0.5 shrink-0 flex items-center justify-center h-6 w-6 rounded-md border transition-all ${isComparing ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"}`}
              title={isComparing ? "取消比較" : "加入比較"}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
            </button>
            <div>
              <h3 className="truncate text-sm font-semibold text-foreground">
                {vehicle.brand} {vehicle.model}
              </h3>
              <p className="text-xs text-muted-foreground">{vehicle.modelYear}年款</p>
            </div>
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
        {featureList.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {featureList.slice(0, 3).map((f: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                {f}
              </Badge>
            ))}
            {featureList.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{featureList.length - 3}
              </Badge>
            )}
          </div>
        )}
        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          <a
            href={`/vehicle/${vehicle.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            看詳情
          </a>
          <a
            href={`https://page.line.me/825oftez?openQrCodeReader=false&msg=${encodeURIComponent(`我想了解這台 ${vehicle.brand} ${vehicle.model} ${vehicle.modelYear}年款 ${vehicle.priceDisplay || vehicle.price + '萬'}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#06C755] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#05b04c] active:bg-[#049a43]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            LINE 問車
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: vehicles, isLoading } = trpc.vehicle.list.useQuery();
  const { data: brands } = trpc.vehicle.brands.useQuery();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const compare = useCompareList();
  const [recentlyViewed] = useState<RecentlyViewedItem[]>(() => getRecentlyViewed());
  const [galleryState, setGalleryState] = useState<{ photos: string[]; index: number; alt: string } | null>(null);
  const openGallery = useCallback((photos: string[], index: number, alt: string) => setGalleryState({ photos, index, alt }), []);

  // Inline chatbot state — persist across tab close with localStorage
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSessionId] = useState(() => {
    const stored = localStorage.getItem("kun-chat-session");
    if (stored) return stored;
    const id = nanoid();
    localStorage.setItem("kun-chat-session", id);
    return id;
  });
  const [chatMessages, setChatMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem("kun-chat-messages");
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (parsed.length > 1) return parsed; // has real messages beyond system
      }
    } catch { /* ignore corrupt data */ }
    return [{ role: "system", content: "你是崑家汽車的AI智能客服助理。" }];
  });

  // Persist chat messages to localStorage
  useEffect(() => {
    if (chatMessages.length > 1) {
      localStorage.setItem("kun-chat-messages", JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  // Count user messages to trigger LINE CTA
  const userMessageCount = useMemo(() => chatMessages.filter(m => m.role === "user").length, [chatMessages]);

  const chatMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setChatMessages((prev) => {
        const updated = [...prev, { role: "assistant" as const, content: data.response }];
        // After 3 user exchanges, append LINE CTA message
        const userCount = updated.filter(m => m.role === "user").length;
        if (userCount === 3 && !prev.some(m => m.content.includes("@825oftez"))) {
          updated.push({
            role: "assistant" as const,
            content: "\n\n---\n\n📣 **想要更詳盡的專人諮詢服務？**\n\n加入我們的 LINE 官方帳號 **@825oftez**，專人為您服務，讓您買車更安心！\n\n👉 [點此加 LINE 好友](https://lin.ee/825oftez)"
          });
        }
        return updated;
      });
    },
    onError: () => {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "抱歉，系統暫時忙禄中。您可以加 LINE @825oftez 聯繫我們。" }]);
    },
  });
  // A/B test: rotate prompt sets, assign variant on first visit
  const [promptVariant] = useState<string>(() => {
    const stored = localStorage.getItem("kun-prompt-variant");
    if (stored && ["A", "B", "C"].includes(stored)) return stored;
    const v = ["A", "B", "C"][Math.floor(Math.random() * 3)];
    localStorage.setItem("kun-prompt-variant", v);
    return v;
  });
  const chatPrompts = useMemo(() => {
    const variants: Record<string, string[]> = {
      A: ["目前有哪些車可以看？", "有沒有50萬以下的SUV？", "我想找一台省油的家庭用車"],
      B: ["最近有什麼新進的車？", "幫我推薦適合小家庭的車", "有沒有可以貸款的方案？"],
      C: ["你們的車有保固嗎？", "想找一台代步小車，預算30萬", "可以預約看車嗎？"],
    };
    return variants[promptVariant] || variants.A;
  }, [promptVariant]);
  const handleChatSend = (content: string) => {
    setChatMessages((prev) => [...prev, { role: "user", content }]);
    chatMutation.mutate({ sessionId: chatSessionId, message: content, channel: "web" });
    // Track suggested prompt clicks for A/B analysis
    if (chatPrompts.includes(content)) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `/_event/prompt-click/${promptVariant}` }),
        keepalive: true,
      }).catch(() => {});
    }
  };

  const chatExternalActions = useMemo(() => [
    {
      label: "加賴直接聊",
      href: "https://page.line.me/825oftez",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current shrink-0">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
      ),
    },
  ], []);

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter((v) => {
      if (selectedBrand !== "all" && v.brand !== selectedBrand) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          v.brand.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          (v.features || "").toLowerCase().includes(q) ||
          (v.bodyType || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (priceRange !== "all") {
        const price = Number(v.price);
        if (priceRange === "under30" && price >= 30) return false;
        if (priceRange === "30to50" && (price < 30 || price >= 50)) return false;
        if (priceRange === "50to80" && (price < 50 || price >= 80)) return false;
        if (priceRange === "over80" && price < 80) return false;
      }
      return true;
    });
  }, [vehicles, searchQuery, selectedBrand, priceRange]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section — slim horizontal banner */}
      <header className="relative bg-[#303d4e] text-white">
        <div className="container relative py-4 sm:py-5">
          {/* Single row: LINE QR | Logo + tagline | CTA button */}
          <div className="flex items-center justify-between gap-4">
            {/* LEFT: LINE QR compact */}
            <a
              href="https://page.line.me/825oftez"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex shrink-0 items-center gap-3 rounded-lg bg-white/[0.07] border border-white/[0.1] px-3 py-2 transition-all hover:bg-white/[0.12]"
            >
              <div className="shrink-0 rounded-md bg-white p-1">
                <img
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663029682479/VgJIqcpDxJHGzjYs.png"
                  alt="LINE QR Code"
                  className="h-10 w-10"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[#06C755] shrink-0">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  <span className="text-xs font-bold text-white">加賴問車</span>
                  <span className="text-[10px] text-[#06C755] font-mono font-semibold">@825oftez</span>
                </div>
              </div>
            </a>

            {/* CENTER: Logo + tagline */}
            <div className="flex flex-col items-center flex-1">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663029682479/HUwsVqzcZmQPFDJR.jpg"
                alt="崑家二手汽車經銷商 KUN MOTORS"
                className="h-28 w-auto sm:h-[9.5rem] md:h-[10.8rem]"
                style={{ mixBlendMode: "screen" }}
              />
              <p className="text-[11px] sm:text-xs tracking-[0.15em] text-white/75 font-medium mt-1">
                台灣南部在地 40 年老口碑·正派經營
              </p>
            </div>


          </div>

          {/* Bottom info strip */}
          <div className="mt-2 flex justify-center flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-xs text-white/50">
            <a href="https://maps.google.com/?q=高雄市三民區大順二路269號" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white/80 transition-colors underline underline-offset-2">
              <MapPin className="h-3 w-3" /> 高雄市三民區大順二路269號
            </a>
            <span className="w-px h-2.5 bg-white/15" />
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" /> 車況保證
            </span>
            <span className="w-px h-2.5 bg-white/15" />
            <span>歡迎攜帶驗車師傅隨同現場驗車</span>
          </div>
        </div>
      </header>

      {/* Trust Signal Strip */}
      <div className="border-b bg-white">
        <div className="container py-2.5">
          <div className="grid grid-cols-2 gap-y-1.5 sm:flex sm:flex-row sm:flex-nowrap sm:items-center sm:justify-center sm:gap-x-6 text-xs sm:text-sm text-gray-600 text-center">
            <span>✅ 累計服務 2,000+ 位車主</span>
            <span>⭐ Google 評分 4.8</span>
            <span>🔐 全車第三方認證</span>
            <span>📍 高雄在地 40 年</span>
          </div>
        </div>
      </div>

      {/* Smart Welcome Back Banner */}
      <WelcomeBack />

      {/* Search & Filter */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜尋車款、品牌、配備..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="w-[120px] sm:w-[140px]">
                <SelectValue placeholder="品牌" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部品牌</SelectItem>
                {brands?.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger className="w-[120px] sm:w-[140px]">
                <SelectValue placeholder="價格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部價格</SelectItem>
                <SelectItem value="under30">30萬以下</SelectItem>
                <SelectItem value="30to50">30-50萬</SelectItem>
                <SelectItem value="50to80">50-80萬</SelectItem>
                <SelectItem value="over80">80萬以上</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Social Proof Strip */}
      <div className="border-b bg-muted/30">
        <div className="container py-3">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Shield className="h-4 w-4 text-primary" />
              全車第三方認證
            </span>
            <span className="hidden sm:block w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="text-base">💰</span>
              超強貸款團隊
            </span>
            <span className="hidden sm:block w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="text-base">🚗</span>
              外縣市免費接駁
            </span>
            <span className="hidden sm:block w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="text-base">⚡</span>
              最快3小時交車
            </span>
            <span className="hidden sm:block w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="text-base">🔄</span>
              舊車高價收購
            </span>
          </div>
        </div>
      </div>

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <div className="container pt-5 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">最近瀏覽過的車</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recentlyViewed.map((item) => (
              <a
                key={item.id}
                href={`/vehicle/${item.id}`}
                className="shrink-0 flex items-center gap-3 rounded-xl border bg-background p-2 pr-4 hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                  {item.photo ? (
                    <img src={item.photo} alt={`${item.brand} ${item.model}`} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><Car className="h-5 w-5 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{item.brand} {item.model}</p>
                  <p className="text-xs text-primary font-bold">{item.price}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Vehicle Grid */}
      <main className="container py-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            在售車輛
            {!isLoading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredVehicles.length} 輛)
              </span>
            )}
          </h2>
          <TodayActivity className="text-muted-foreground" />
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        ) : filteredVehicles.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Car className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>沒有符合條件的車輛</p>
            <p className="mt-1 text-sm">試試調整搜尋條件</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} isComparing={compare.has(v.id)} onToggleCompare={() => compare.toggle(v.id)} onOpenGallery={openGallery} />
            ))}
          </div>
        )}
      </main>

      <SeoFooter />

      {/* Floating Chat Popup */}
      {chatOpen && (
        <div className="fixed bottom-36 md:bottom-24 right-6 z-50 w-full sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-background shadow-2xl flex flex-col" style={{ height: 'min(540px, calc(100vh - 7rem))' }}>
          {/* Chat header */}
          <div className="flex items-center justify-between bg-primary px-4 py-2.5 text-primary-foreground shrink-0">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <p className="text-sm font-semibold leading-tight">崑家汽車在線貼心諮詢</p>
            </div>
            <button onClick={() => setChatOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Chat body - flex-1 with min-h-0 to allow proper scrolling */}
          <div className="flex-1 min-h-0">
            <AIChatBox
              messages={chatMessages}
              onSendMessage={handleChatSend}
              isLoading={chatMutation.isPending}
              placeholder="請輸入您想詢問的車輛問題..."
              height="100%"
              emptyStateMessage="歡迎來到崑家汽車！有什麼我可以幫您的嗎？"
              suggestedPrompts={chatPrompts}
              externalActions={chatExternalActions}
              className="border-0 shadow-none rounded-none h-full"
            />
          </div>
        </div>
      )}

      {/* Vehicle Compare Bar */}
      <CompareBar ids={compare.ids} onClear={compare.clear} />

      <StickyBookingBar />

      {/* Fullscreen Gallery Modal */}
      {galleryState && (
        <Suspense fallback={null}>
          <FullscreenGallery
            photos={galleryState.photos}
            initialIndex={galleryState.index}
            alt={galleryState.alt}
            onClose={() => setGalleryState(null)}
          />
        </Suspense>
      )}

      {/* Wishlist Drawer */}
      <WishlistDrawer />

      {/* Floating Chat Button with Tooltip */}
      <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-3">
        {!chatOpen && (
          <div className="rounded-full bg-primary/90 px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg backdrop-blur-sm">
            <span>有問題？阿家線上回答你</span>
            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rotate-45 bg-primary/90" />
          </div>
        )}
        <button
          onClick={() => setChatOpen((prev) => !prev)}
          className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-110 active:scale-95"
          aria-label={chatOpen ? "關閉聊天" : "開始聊天"}
        >
          {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          {!chatOpen && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
        </button>
      </div>
    </div>
  );
}
