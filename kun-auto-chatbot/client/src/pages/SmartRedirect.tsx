import { useEffect, useState } from "react";
import { Car, MessageCircle, Smartphone, Monitor, ArrowRight, Phone } from "lucide-react";

type DeviceType = "mobile" | "desktop" | "detecting";

function detectDevice(): DeviceType {
  const ua = navigator.userAgent || "";
  // Check for mobile devices
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  ) {
    return "mobile";
  }
  return "desktop";
}

const LINE_URL = "https://page.line.me/825oftez";
const WEBSITE_URL = "/";

export default function SmartRedirect() {
  const [device, setDevice] = useState<DeviceType>("detecting");
  const [countdown, setCountdown] = useState(1);
  const [redirectCancelled, setRedirectCancelled] = useState(false);

  useEffect(() => {
    const detected = detectDevice();
    setDevice(detected);
  }, []);

  useEffect(() => {
    if (device === "detecting" || redirectCancelled) return;

    if (countdown <= 0) {
      if (device === "mobile") {
        window.location.href = LINE_URL;
      } else {
        window.location.href = WEBSITE_URL;
      }
      return;
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [device, countdown, redirectCancelled]);

  const handleCancel = () => {
    setRedirectCancelled(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B3A5C] via-[#1B3A5C] to-[#0f2440] flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-[#C4A265]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 bg-[#C4A265]/5 rounded-full blur-3xl" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Main card */}
        <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#C4A265] to-[#a8893e] shadow-lg shadow-[#C4A265]/20 mb-6">
              <Car className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">崑家汽車</h1>
            <p className="text-white/60 text-sm">高雄優質中古車商 · 誠信經營40年老口碑</p>
          </div>

          {/* Status section */}
          <div className="px-8 pb-8">
            {device === "detecting" ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
                  <div className="w-6 h-6 border-2 border-[#C4A265] border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-white/70 text-sm">正在偵測您的裝置...</p>
              </div>
            ) : !redirectCancelled ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 mb-4">
                  {device === "mobile" ? (
                    <Smartphone className="w-7 h-7 text-[#06C755]" />
                  ) : (
                    <Monitor className="w-7 h-7 text-[#C4A265]" />
                  )}
                </div>

                <p className="text-white text-base font-medium mb-1">
                  {device === "mobile"
                    ? "正在為您開啟 LINE 官方帳號..."
                    : "正在為您導向崑家汽車官網..."}
                </p>
                <p className="text-white/50 text-sm mb-6">
                  {countdown > 0
                    ? `${countdown} 秒後自動跳轉`
                    : "正在跳轉中..."}
                </p>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-6">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${((1 - countdown) / 1) * 100}%`,
                      background:
                        device === "mobile"
                          ? "linear-gradient(90deg, #06C755, #00B900)"
                          : "linear-gradient(90deg, #C4A265, #a8893e)",
                    }}
                  />
                </div>

                <button
                  onClick={handleCancel}
                  className="text-white/40 text-xs hover:text-white/70 transition-colors underline underline-offset-2"
                >
                  取消自動跳轉
                </button>
              </div>
            ) : null}

            {/* Manual selection - shown when cancelled or after detection */}
            {(redirectCancelled || device !== "detecting") && (
              <div className={`space-y-3 ${!redirectCancelled ? "mt-4 pt-4 border-t border-white/10" : "py-2"}`}>
                {redirectCancelled && (
                  <p className="text-white/60 text-sm text-center mb-4">
                    請選擇您想要的聯繫方式：
                  </p>
                )}

                {/* LINE button */}
                <a
                  href={LINE_URL}
                  className="flex items-center gap-4 w-full p-4 rounded-2xl bg-[#06C755]/10 border border-[#06C755]/20 hover:bg-[#06C755]/20 hover:border-[#06C755]/40 transition-all group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#06C755] shadow-lg shadow-[#06C755]/20">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">LINE 官方帳號</p>
                    <p className="text-white/50 text-xs">手機用戶推薦，直接加好友對話</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-[#06C755] transition-colors" />
                </a>

                {/* Website chatbot button */}
                <a
                  href={WEBSITE_URL}
                  className="flex items-center gap-4 w-full p-4 rounded-2xl bg-[#C4A265]/10 border border-[#C4A265]/20 hover:bg-[#C4A265]/20 hover:border-[#C4A265]/40 transition-all group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#C4A265] to-[#a8893e] shadow-lg shadow-[#C4A265]/20">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">崑家汽車官網</p>
                    <p className="text-white/50 text-xs">桌機用戶推薦，瀏覽車輛與線上諮詢</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-[#C4A265] transition-colors" />
                </a>

                {/* Direct call button */}
                <a
                  href="tel:0936812818"
                  className="flex items-center gap-4 w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10">
                    <Phone className="w-6 h-6 text-white/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">直接撥打電話</p>
                    <p className="text-white/50 text-xs">0936-812-818 賴先生</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-white/[0.03] border-t border-white/5">
            <p className="text-center text-white/30 text-xs">
              崑家汽車 · 高雄市三民區大順二路269號 · 24小時線上服務
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
