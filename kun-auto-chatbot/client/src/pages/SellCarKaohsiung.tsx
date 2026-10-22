import { Car, DollarSign, Clock, Shield, Phone, MessageCircle, CheckCircle, ArrowRight } from "lucide-react";
import SeoFooter from "@/components/SeoFooter";
import { FOUNDING_YEAR, yearsInBusiness } from "../../../shared/shopConfig";

const LINE_OA_URL = "https://page.line.me/825oftez";

const SELLING_BENEFITS = [
  { icon: DollarSign, title: "高價收購", desc: "不經中間商，直接高價收購您的愛車" },
  { icon: Clock, title: "快速成交", desc: "現場估價，最快當日完成交易" },
  { icon: Shield, title: "信譽保證", desc: `在地${yearsInBusiness()}年老字號，交易安心有保障` },
  { icon: CheckCircle, title: "手續代辦", desc: "過戶手續全程代辦，省時省力" },
];

const SELLING_STEPS = [
  { step: "1", title: "聯繫諮詢", desc: "致電或 LINE 聯繫，告知車輛基本資訊" },
  { step: "2", title: "現場估價", desc: "專業鑑定師現場評估車況，提供合理報價" },
  { step: "3", title: "確認成交", desc: "價格滿意即可成交，當場簽約" },
  { step: "4", title: "完成過戶", desc: "代辦過戶手續，款項當日結清" },
];

export default function SellCarKaohsiung() {
  const years = yearsInBusiness();

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#1e2a38] to-[#0A0A0F] py-10 px-4">
        <div className="container max-w-4xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            高雄二手車收購
          </h1>
          <p className="text-xl text-white/70 mb-6">
            崑家汽車在地{years}年｜高價收購您的愛車
          </p>
          <p className="text-sm text-white/60 max-w-2xl mx-auto mb-8">
            想賣車？崑家汽車提供免費估價、高價收購服務。不經中間商，直接以舊換新、快速成交。在地經營{years}年，值得您信賴。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:0936812818"
              className="px-8 py-3 rounded-lg bg-[#C4A265] text-[#0A0A0F] font-semibold hover:bg-[#d4b875] transition-colors flex items-center justify-center gap-2"
            >
              <Phone className="h-5 w-5" />
              立即估價 0936-812-818
            </a>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-lg bg-[#06C755] text-white font-semibold hover:bg-[#05b04c] transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              LINE 線上估價
            </a>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="container max-w-4xl py-12 px-4">
        <h2 className="text-2xl font-bold mb-8 text-center">為什麼選擇崑家汽車？</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SELLING_BENEFITS.map((benefit, i) => (
            <div key={i} className="bg-[#1e2a38] rounded-lg p-6 border border-white/10 text-center">
              <benefit.icon className="h-10 w-10 text-[#C4A265] mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">{benefit.title}</h3>
              <p className="text-sm text-white/60">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Process Section */}
      <div className="bg-[#1e2a38]/30 py-12 px-4">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold mb-8 text-center">賣車流程</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SELLING_STEPS.map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-[#1e2a38] rounded-lg p-6 border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-[#C4A265] text-[#0A0A0F] font-bold flex items-center justify-center mb-4">
                    {step.step}
                  </div>
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/60">{step.desc}</p>
                </div>
                {i < SELLING_STEPS.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 h-6 w-6 text-[#C4A265]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Required Documents */}
      <div className="container max-w-4xl py-12 px-4">
        <h2 className="text-2xl font-bold mb-8 text-center">賣車需要什麼文件？</h2>
        <div className="bg-[#1e2a38] rounded-lg p-6 md:p-8 border border-white/10">
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-[#C4A265] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">身分證正本</p>
                <p className="text-sm text-white/60">車主本人身分證明</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-[#C4A265] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">行照正本</p>
                <p className="text-sm text-white/60">車輛行車執照</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-[#C4A265] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">印鑑章</p>
                <p className="text-sm text-white/60">用於過戶相關文件</p>
              </div>
            </li>
          </ul>
          <p className="mt-6 text-sm text-white/50">
            詳細流程請洽門市 0936-812-818 或 LINE 官方帳號。
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-[#1e2a38]/30 py-12 px-4">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold mb-8">常見問題</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-[#C4A265] pl-6">
              <h3 className="font-semibold text-white mb-2">
                崑家汽車收購二手車嗎？
              </h3>
              <p className="text-white/70 text-sm">
                收購，崑家汽車提供高雄在地{years}年免費估價、高價收購服務。請洽門市 0936-812-818 或 LINE 官方帳號。
              </p>
            </div>

            <div className="border-l-4 border-[#C4A265] pl-6">
              <h3 className="font-semibold text-white mb-2">
                估價要多久？
              </h3>
              <p className="text-white/70 text-sm">
                現場估價約15-30分鐘。詳細資訊請洽門市 0936-812-818 或 LINE 官方帳號。
              </p>
            </div>

            <div className="border-l-4 border-[#C4A265] pl-6">
              <h3 className="font-semibold text-white mb-2">
                可以以舊換新嗎？
              </h3>
              <p className="text-white/70 text-sm">
                可以，崑家汽車提供舊車折扣方案，直接折抵新車車價。詳細資訊請洽門市 0936-812-818 或 LINE 官方帳號。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-[#1e2a38] py-10 px-4 border-t border-white/10">
        <div className="container max-w-4xl text-center">
          <Car className="h-12 w-12 text-[#C4A265] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">想賣車？現在就聯繫我們</h2>
          <p className="text-white/70 mb-6">
            崑家汽車在地{years}年，提供高價收購、免費估價服務。
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
