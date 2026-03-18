import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface FullscreenGalleryProps {
  photos: string[];
  initialIndex: number;
  alt: string;
  onClose: () => void;
}

export default function FullscreenGallery({ photos, initialIndex, alt, onClose }: FullscreenGalleryProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const total = photos.length;
  const goNext = useCallback(() => setCurrent((p) => (p + 1) % total), [total]);
  const goPrev = useCallback(() => setCurrent((p) => (p - 1 + total) % total), [total]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, goNext, goPrev]);

  // Reset zoom on photo change
  useEffect(() => setZoomed(false), [current]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomed) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (zoomed) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (zoomed || !touchStart || !touchEnd) return;
    const d = touchStart - touchEnd;
    if (Math.abs(d) >= 50) {
      d > 0 ? goNext() : goPrev();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-sm font-medium">{current + 1} / {total}</span>
        <span className="text-sm truncate max-w-[50%] text-center">{alt}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label={zoomed ? "縮小" : "放大"}
          >
            {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main photo area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={photos[current]}
          alt={`${alt} - ${current + 1}/${total}`}
          className={`max-h-full max-w-full object-contain transition-transform duration-300 select-none ${
            zoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
          }`}
          onClick={() => setZoomed((z) => !z)}
          draggable={false}
        />

        {/* Nav arrows */}
        {total > 1 && !zoomed && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="px-4 py-3 flex justify-center gap-1.5 overflow-x-auto">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                i === current ? "border-white opacity-100 scale-105" : "border-transparent opacity-40 hover:opacity-70"
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
