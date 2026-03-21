import { useState, useEffect } from "react";
import { X, MessageCircle } from "lucide-react";

interface ProactiveChatTriggerProps {
  /** Delay in ms before showing the trigger */
  delay?: number;
  /** Message to display */
  message?: string;
  /** CTA label */
  ctaLabel?: string;
  /** Where to link (default: LINE) */
  ctaHref?: string;
  /** Vehicle name for context */
  vehicleName?: string;
}

/**
 * Proactive chat nudge that appears after user browses for a while.
 * Slides in from the bottom-left with a helpful suggestion.
 *
 * Only shows once per session per page to avoid annoyance.
 */
export default function ProactiveChatTrigger({
  delay = 15000,
  message,
  ctaLabel = "LINE 問問阿家",
  ctaHref = "https://page.line.me/825oftez",
  vehicleName,
}: ProactiveChatTriggerProps) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const defaultMessage = vehicleName
    ? `看了 ${vehicleName} 有什麼疑問嗎？阿家幫你解答！`
    : "需要幫你算貸款或推薦適合的車嗎？";

  useEffect(() => {
    // Only show once per session
    const key = `kun-proactive-${vehicleName || "home"}`;
    if (sessionStorage.getItem(key)) return;

    const timer = setTimeout(() => {
      setShow(true);
      sessionStorage.setItem(key, "1");
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, vehicleName]);

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-24 md:bottom-20 left-4 z-40 max-w-[280px] animate-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1B3A5C] px-3 py-2">
          <div className="flex items-center gap-2 text-white">
            <div className="w-7 h-7 rounded-full bg-[#C4A265] flex items-center justify-center text-xs">阿</div>
            <span className="text-xs font-medium">高雄阿家</span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/60"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700 leading-relaxed">{message || defaultMessage}</p>
        </div>
        {/* CTA */}
        <div className="px-4 pb-3 flex gap-2">
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#06C755] px-3 py-2 text-xs font-bold text-white hover:bg-[#05b04c] transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {ctaLabel}
          </a>
          <a
            href="/book-visit"
            className="flex items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            預約看車
          </a>
        </div>
      </div>
      {/* Speech bubble tail */}
      <div className="ml-6 w-3 h-3 bg-white border-r border-b border-gray-100 transform rotate-45 -mt-1.5" />
    </div>
  );
}
