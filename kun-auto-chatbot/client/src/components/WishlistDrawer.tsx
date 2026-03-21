import { useState, useEffect, useCallback } from "react";
import { Heart, X, Trash2, Car } from "lucide-react";
import {
  getWishlist,
  getWishlistCount,
  removeFromWishlist,
  onWishlistChange,
  type WishlistItem,
} from "@/lib/wishlist";

export default function WishlistDrawer() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(() => getWishlistCount());
  const [items, setItems] = useState<WishlistItem[]>([]);

  // Sync count on wishlist changes
  useEffect(() => {
    return onWishlistChange(() => {
      setCount(getWishlistCount());
      if (open) setItems(getWishlist());
    });
  }, [open]);

  const openDrawer = useCallback(() => {
    setItems(getWishlist());
    setOpen(true);
  }, []);

  const handleRemove = useCallback((id: number) => {
    removeFromWishlist(id);
    setItems(getWishlist());
    setCount(getWishlistCount());
  }, []);

  return (
    <>
      {/* Floating trigger button -- bottom-right, above sticky bar */}
      <button
        onClick={openDrawer}
        className="fixed bottom-36 md:bottom-20 left-4 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-[#1B3A5C] border border-[#C4A265]/30 shadow-lg transition-transform hover:scale-110 active:scale-95"
        aria-label="收藏清單"
      >
        <Heart className="w-5 h-5 text-[#C4A265]" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#C4A265] text-white text-[10px] font-bold px-1">
            {count}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-[#1B3A5C] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#C4A265]" />
            <h2 className="text-white font-bold text-lg">
              我的收藏
              {items.length > 0 && (
                <span className="ml-1.5 text-sm font-normal text-white/40">({items.length})</span>
              )}
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full p-1.5 hover:bg-white/10 transition-colors"
            aria-label="關閉收藏清單"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ height: "calc(100% - 65px - 72px)" }}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Car className="w-14 h-14 text-white/15 mb-4" />
              <p className="text-white/50 text-sm mb-1">
                還沒有收藏車輛
              </p>
              <p className="text-white/30 text-xs">
                瀏覽車庫開始收藏！
              </p>
              <a
                href="/"
                className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-[#C4A265] text-white text-sm font-medium hover:bg-[#a8893e] transition-colors"
              >
                瀏覽車庫
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={`/vehicle/${item.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-all"
                >
                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-black/20 flex-shrink-0">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt={`${item.brand} ${item.model}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className="w-6 h-6 text-white/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {item.brand} {item.model}
                    </p>
                    <p className="text-[#C4A265] font-bold text-sm">{item.price}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                    className="flex-shrink-0 p-2 rounded-full hover:bg-white/10 transition-colors"
                    aria-label={`移除 ${item.brand} ${item.model}`}
                  >
                    <Trash2 className="w-4 h-4 text-white/30 hover:text-red-400" />
                  </button>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {items.length > 0 && (
          <div className="border-t border-white/10 px-5 py-4">
            <a
              href={`https://page.line.me/825oftez?openQrCodeReader=false&msg=${encodeURIComponent(
                `我想了解這些收藏車輛：${items.map((i) => `${i.brand} ${i.model}`).join("、")}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#06C755] text-white text-sm font-semibold hover:bg-[#05b04c] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current shrink-0">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              想了解收藏車輛？LINE 一次問
            </a>
          </div>
        )}
      </div>
    </>
  );
}
