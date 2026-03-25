import { useState, useEffect } from "react";

interface StickyBookingBarProps {
  vehicleId?: number | string;
  vehicleName?: string;
}

export default function StickyBookingBar({ vehicleId, vehicleName }: StickyBookingBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 200);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Check immediately in case the page is already scrolled
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const bookUrl = vehicleId
    ? `/book-visit?vehicleId=${vehicleId}&vehicle=${encodeURIComponent(vehicleName || "")}`
    : "/book-visit";

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-50
        flex lg:hidden
        transition-transform duration-300 ease-out
        ${visible ? "translate-y-0" : "translate-y-full"}
        shadow-[0_-4px_16px_rgba(0,0,0,0.15)]
      `}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <a
        href={bookUrl}
        className="flex flex-1 items-center justify-center gap-2 py-4 min-h-[44px] text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-75"
        style={{ backgroundColor: "#06C755" }}
      >
        📅 免費預約看車
      </a>
      <a
        href="tel:0936812818"
        className="flex flex-1 items-center justify-center gap-2 py-4 min-h-[44px] text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-75"
        style={{ backgroundColor: "#1a237e" }}
      >
        📞 直撥電話
      </a>
    </div>
  );
}
