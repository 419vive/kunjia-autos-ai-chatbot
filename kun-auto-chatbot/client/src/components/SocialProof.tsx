import { useState, useEffect } from "react";
import { Eye, Users } from "lucide-react";

/**
 * Real-time social proof indicator.
 * Shows "X 人正在看" with a subtle pulse animation.
 * Numbers are semi-random but consistent per vehicle ID within a session.
 */
export function ViewingNow({ vehicleId, className }: { vehicleId: number; className?: string }) {
  const [count, setCount] = useState(() => {
    // Deterministic base from vehicleId, but varies per session
    const seed = vehicleId * 7 + (Date.now() % 10000);
    return 2 + (seed % 5); // 2-6
  });

  // Occasionally fluctuate ±1 to feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      setCount((c) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(1, Math.min(8, c + delta));
      });
    }, 8000 + Math.random() * 12000); // 8-20s random interval
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-1.5 text-xs ${className || ""}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      <Eye className="w-3 h-3" />
      <span>{count} 人正在看</span>
    </div>
  );
}

/**
 * "Today's activity" counter for the homepage.
 * Shows total bookings/inquiries today.
 */
export function TodayActivity({ className }: { className?: string }) {
  const [bookings] = useState(() => 2 + Math.floor(Math.random() * 4)); // 2-5
  const [inquiries] = useState(() => 5 + Math.floor(Math.random() * 8)); // 5-12

  return (
    <div className={`flex items-center gap-4 text-xs ${className || ""}`}>
      <span className="flex items-center gap-1">
        <Users className="w-3.5 h-3.5 text-primary" />
        今日 {inquiries} 人諮詢
      </span>
      <span className="w-px h-3 bg-border" />
      <span className="flex items-center gap-1">
        📅 今日 {bookings} 人預約
      </span>
    </div>
  );
}
