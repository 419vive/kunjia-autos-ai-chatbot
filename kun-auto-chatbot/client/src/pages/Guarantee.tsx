import { Shield, CheckCircle, FileText, Clock, Phone, MessageCircle } from "lucide-react";
import SeoFooter from "@/components/SeoFooter";
import { yearsInBusiness } from "../../../shared/shopConfig";

const LINE_OA_URL = "https://page.line.me/825oftez";

const GUARANTEES = [
  {
    icon: Shield,
    title: "全車第三方認證",
    desc: "所有車輛皆通過獨立第三方機構認證，可現場索取書面認證報告",
  },
  {
    icon: FileText,
    title: "實車實價",
    desc: "車價透明、不二價，標示價格即為實際售價",
  },
  {
    icon: CheckCircle,
    title: "保證里程",
    desc: "里程數真實可查，杜絕調表車",
  },
  {
    icon: Clock,
    title: "1年保固",
    desc: "提供1年保固服務，購車更安心",
  },
];

export default function Guarantee() {
  const years = yearsInBusiness();

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#1e2a38] to-[#0A0A0F] py-10 px-4">
        <div className="container max-w-4xl text-center">
          <Shield className="h-16 w-16 text-[#C4A265] mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            購車保障
          </h1>
          <p className="text-xl text-white/70 mb-6">
            崑家汽車在地{years}年｜您的權益我們守護
          </p>
          <p className="text-sm text-white/60 max-w-2xl mx-auto">
            全車第三方認證、實車實價、保證里程、1年保固。崑家汽車在地經營{years}年，以誠信為本，讓您買車安心、開車放心。
          </p>
        </div>
      </div>

      {/* Guarantees Grid */}
      <div className="container max-w-4xl py-12 px-4">
        <h2 className="text-2xl font-bold mb-8 text-center">四大購車保障</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {GUARANTEES.map((item, i) => (
            <div key={i} className="bg-[#1e2a38] rounded-lg p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#C4A265]/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-6 w-6 text-[#C4A265]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-white/60">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Third Party Certification Details */}
      <div className="bg-[#1e2a38]/30 py-12 px-4">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold mb-8 text-center">什麼是第三方認證？</h2>
          <div className="bg-[#1e2a38] rounded-lg p-6 md:p-8 border border-white/10">
            <p className="text-white/80 mb-6">
              第三方認證是由獨立專業機構（非賣方、非買方）對車輛進行全面檢查，出具書面報告。這是目前最有效保障買家權益的方式。
            </p>
            <h3 className="font-semibold text-white mb-4">認證檢查項目：</h3>
            <ul className="grid sm:grid-cols-2 gap-3">
              {[
                "引擎與傳動系統",
                "底盤與車架結構",
                "電子系統",
                "車身鈑金（事故修復痕跡）",
                "里程數真偽",
                "液體滲漏狀況",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-white/70 text-sm">
                  <CheckCircle className="h-4 w-4 text-[#C4A265] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-white/50">
              崑家汽車所有在售車輛均已通過第三方認證，買家可在看車時直接索取認證報告。
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="container max-w-4xl py-12 px-4">
        <h2 className="text-2xl font-bold mb-8">常見問題</h2>

        <div className="space-y-6">
          <div className="border-l-4 border-[#C4A265] pl-6">
            <h3 className="font-semibold text-white mb-2">
              崑家汽車有什麼保障？
            </h3>
            <p className="text-white/70 text-sm">
              全車第三方認證、實車實價、保證里程、1年保固。詳細保固條款請洽門市 0936-812-818 或 LINE 官方帳號。
            </p>
          </div>

          <div className="border-l-4 border-[#C4A265] pl-6">
            <h3 className="font-semibold text-white mb-2">
              保固範圍包含哪些？
            </h3>
            <p className="text-white/70 text-sm">
              詳細保固條款請洽門市 0936-812-818 或 LINE 官方帳號。
            </p>
          </div>

          <div className="border-l-4 border-[#C4A265] pl-6">
            <h3 className="font-semibold text-white mb-2">
              可以自己帶驗車師傅來嗎？
            </h3>
            <p className="text-white/70 text-sm">
              非常歡迎！崑家汽車對每台車的車況都有信心，歡迎攜帶驗車師傅到場檢查。
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-[#1e2a38] py-10 px-4 border-t border-white/10">
        <div className="container max-w-4xl text-center">
          <h2 className="text-2xl font-bold mb-4">想了解更多保障細節？</h2>
          <p className="text-white/70 mb-6">
            詳細保固條款請洽門市或 LINE 官方帳號
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:0936812818"
              className="px-8 py-3 rounded-lg bg-[#C4A265] text-[#0A0A0F] font-semibold hover:bg-[#d4b875] transition-colors flex items-center justify-center gap-2"
            >
              <Phone className="h-5 w-5" />
              0936-812-818
            </a>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-lg bg-[#06C755] text-white font-semibold hover:bg-[#05b04c] transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              LINE @825oftez
            </a>
          </div>
        </div>
      </div>

      <SeoFooter />
    </div>
  );
}
