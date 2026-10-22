import { useState, useMemo } from "react";
import { Calculator, DollarSign, Calendar, Percent, HelpCircle, Phone, MessageCircle } from "lucide-react";
import SeoFooter from "@/components/SeoFooter";

const LINE_OA_URL = "https://page.line.me/825oftez";

interface LoanResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
}

export default function LoanCalculator() {
  const [principal, setPrincipal] = useState(500000);
  const [months, setMonths] = useState(60);
  const [rate, setRate] = useState(5.0);

  const result = useMemo<LoanResult | null>(() => {
    if (principal <= 0 || months <= 0 || rate < 0) return null;

    const monthlyRate = rate / 100 / 12;
    
    if (monthlyRate === 0) {
      const monthlyPayment = principal / months;
      return {
        monthlyPayment,
        totalPayment: principal,
        totalInterest: 0,
      };
    }

    const monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, months) 
      / (Math.pow(1 + monthlyRate, months) - 1);
    const totalPayment = monthlyPayment * months;
    const totalInterest = totalPayment - principal;

    return {
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
    };
  }, [principal, months, rate]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#1e2a38] to-[#0A0A0F] py-8 px-4">
        <div className="container max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white">
            二手車貸款試算
          </h1>
          <p className="text-xl text-white/70 mb-4">
            中古車貸款月付金計算
          </p>
          <p className="text-sm text-white/60">
            輸入車價、期數和利率，立即計算每月還款金額。崑家汽車合作多家銀行，貸款成數50%-80%，最快一天核准。
          </p>
        </div>
      </div>

      {/* Calculator Tool */}
      <div className="container max-w-4xl py-10 px-4">
        <div className="bg-[#1e2a38] rounded-lg p-6 md:p-8 border border-white/10">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-[#C4A265]" />
            貸款條件
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Principal Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                <DollarSign className="inline h-4 w-4 mr-1" />
                貸款金額 (元)
              </label>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(parseInt(e.target.value) || 0)}
                min="10000"
                step="10000"
                className="w-full px-4 py-2 rounded-lg bg-[#0A0A0F] text-white border border-white/20 focus:border-[#C4A265] focus:outline-none transition-colors tabular-nums"
              />
              <p className="text-xs text-white/50 mt-1">建議輸入車價 × 貸款成數</p>
            </div>

            {/* Months Select */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                分期期數 (月)
              </label>
              <select
                value={months}
                onChange={(e) => setMonths(parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-[#0A0A0F] text-white border border-white/20 focus:border-[#C4A265] focus:outline-none transition-colors"
              >
                <option value={12}>12期 (1年)</option>
                <option value={24}>24期 (2年)</option>
                <option value={36}>36期 (3年)</option>
                <option value={48}>48期 (4年)</option>
                <option value={60}>60期 (5年)</option>
                <option value={72}>72期 (6年)</option>
                <option value={84}>84期 (7年)</option>
              </select>
            </div>

            {/* Interest Rate Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                <Percent className="inline h-4 w-4 mr-1" />
                年利率 (%)
              </label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                min="0"
                max="20"
                step="0.1"
                className="w-full px-4 py-2 rounded-lg bg-[#0A0A0F] text-white border border-white/20 focus:border-[#C4A265] focus:outline-none transition-colors tabular-nums"
              />
              <p className="text-xs text-white/50 mt-1">請洽門市確認實際利率</p>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {/* Monthly Payment Card */}
            <div className="bg-[#1e2a38] rounded-lg p-6 border border-[#C4A265]/30">
              <h3 className="text-sm font-medium text-white/60 mb-2">每月還款金額</h3>
              <p className="text-3xl font-bold text-[#C4A265] mb-2 tabular-nums">
                {result.monthlyPayment.toLocaleString("zh-TW")}
              </p>
              <p className="text-xs text-white/50">新台幣 / 月</p>
            </div>

            {/* Total Payment Card */}
            <div className="bg-[#1e2a38] rounded-lg p-6 border border-white/10">
              <h3 className="text-sm font-medium text-white/60 mb-2">總還款金額</h3>
              <p className="text-2xl font-semibold text-white tabular-nums">
                {result.totalPayment.toLocaleString("zh-TW")}
              </p>
              <p className="text-xs text-white/50">新台幣</p>
            </div>

            {/* Total Interest Card */}
            <div className="bg-[#1e2a38] rounded-lg p-6 border border-white/10">
              <h3 className="text-sm font-medium text-white/60 mb-2">總利息支出</h3>
              <p className="text-2xl font-semibold text-white tabular-nums">
                {result.totalInterest.toLocaleString("zh-TW")}
              </p>
              <p className="text-xs text-white/50">新台幣</p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-[#1e2a38]/50 rounded-lg p-6 border border-white/10">
          <p className="text-xs text-white/60 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C4A265]" />
            <span>
              本試算僅供參考，實際貸款條件（利率、成數、期數）依個人信用狀況及銀行審核為準。崑家汽車合作多家銀行，可協助規劃最適合您的貸款方案。詳情請洽門市 0936-812-818 或 LINE 官方帳號。
            </span>
          </p>
        </div>

        {/* CTA Section */}
        <div className="mt-8 bg-[#1e2a38] rounded-lg p-6 border border-white/10 text-center">
          <h3 className="text-xl font-bold mb-4">想知道您的貸款方案？</h3>
          <p className="text-white/70 mb-6 text-sm">
            崑家汽車合作多家銀行，提供多種貸款方案，最快一天核准。歡迎聯繫我們取得專屬報價。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="tel:0936812818"
              className="px-6 py-2 rounded-lg bg-[#C4A265] text-[#0A0A0F] font-semibold hover:bg-[#d4b875] transition-colors flex items-center justify-center gap-2"
            >
              <Phone className="h-4 w-4" />
              0936-812-818
            </a>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 rounded-lg bg-[#06C755] text-white font-semibold hover:bg-[#05b04c] transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              LINE 諮詢
            </a>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-[#1e2a38]/30 py-12 px-4">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold mb-8">貸款常見問題</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-[#C4A265] pl-6">
              <h3 className="font-semibold text-white mb-2">
                二手車貸款成數是多少？
              </h3>
              <p className="text-white/70 text-sm">
                一般為車價的50%-80%，依車齡和信用評分而定。詳細方案請洽門市 0936-812-818 或 LINE 官方帳號。
              </p>
            </div>

            <div className="border-l-4 border-[#C4A265] pl-6">
              <h3 className="font-semibold text-white mb-2">
                二手車貸款最快多久核准？
              </h3>
              <p className="text-white/70 text-sm">
                崑家汽車合作銀行最快一天核准，一般1-3個工作天。詳細資訊請洽門市 0936-812-818 或 LINE 官方帳號。
              </p>
            </div>

            <div className="border-l-4 border-[#C4A265] pl-6">
              <h3 className="font-semibold text-white mb-2">
                二手車貸款需要什麼文件？
              </h3>
              <p className="text-white/70 text-sm">
                身分證影本、近3個月薪資轉帳存摺、在職證明即可。詳細資訊請洽門市 0936-812-818 或 LINE 官方帳號。
              </p>
            </div>

            <div className="border-l-4 border-[#C4A265] pl-6">
              <h3 className="font-semibold text-white mb-2">
                還款方式有哪些？
              </h3>
              <p className="text-white/70 text-sm">
                主要為本息攤還（每月固定金額），部分方案可選本金攤還（前期高、後期低）。詳細資訊請洽門市 0936-812-818 或 LINE 官方帳號。
              </p>
            </div>
          </div>
        </div>
      </div>

      <SeoFooter />
    </div>
  );
}
