import { useState, useEffect, useMemo } from "react";
import { X, Car, ArrowRight } from "lucide-react";
import { getRecentlyViewed } from "@/lib/recentlyViewed";

/**
 * Smart welcome-back banner for returning visitors.
 * Shows their last viewed vehicle with a warm greeting.
 * Only appears for returning visitors (has recently viewed vehicles).
 */
export default function WelcomeBack() {
  const [dismissed, setDismissed] = useState(false);
  const [isNew, setIsNew] = useState(true);

  const recent = useMemo(() => getRecentlyViewed(), []);

  useEffect(() => {
    // Check if user has visited before
    const visits = parseInt(localStorage.getItem("kun-visit-count") || "0", 10);
    localStorage.setItem("kun-visit-count", String(visits + 1));
    localStorage.setItem("kun-last-visit", new Date().toISOString());
    setIsNew(visits === 0);
  }, []);

  // Don't show for first-time visitors or if dismissed
  if (isNew || dismissed || recent.length === 0) return null;

  // Check if already dismissed this session
  const sessionKey = "kun-welcome-dismissed";
  if (sessionStorage.getItem(sessionKey)) return null;

  const lastCar = recent[0];
  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(sessionKey, "1");
  };

  return (
    <div className="border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-in slide-in-from-top duration-500">
      <div className="container py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Thumbnail */}
            {lastCar.photo && (
              <a href={`/vehicle/${lastCar.id}`} className="shrink-0 h-10 w-14 rounded-lg overflow-hidden bg-muted">
                <img src={lastCar.photo} alt={`${lastCar.brand} ${lastCar.model}`} className="h-full w-full object-cover" />
              </a>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                歡迎回來！上次看了 <span className="text-primary font-bold">{lastCar.brand} {lastCar.model}</span>
              </p>
              <p className="text-xs text-muted-foreground">還有興趣嗎？點這裡繼續了解</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/vehicle/${lastCar.id}`}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              看看 <ArrowRight className="w-3 h-3" />
            </a>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="關閉"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
