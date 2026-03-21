import { ChevronRight, HelpCircle } from "lucide-react";
import { useState } from "react";
import SeoFooter from "@/components/SeoFooter";

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FaqItem[] = [
  // 看車預約
  {
    category: "看車預約",
    question: "預約看車要付費嗎？",
    answer: "完全免費，無任何費用或義務。來看車不滿意也沒關係。",
  },
  {
    category: "看車預約",
    question: "預約後多快會有人聯絡我？",
    answer: "一般1小時內，最慢當天營業時間內回電確認。",
  },
  {
    category: "看車預約",
    question: "外縣市的客人可以預約嗎？",
    answer: "可以，我們提供外縣市接駁服務，詳情請聯絡賴先生。",
  },
  // 購車相關
  {
    category: "購車相關",
    question: "崑家汽車在哪裡？",
    answer: "崑家汽車位於高雄市三民區大順二路269號（肯德基斜對面），在地經營超過40年。營業時間為週一至週六 09:00-21:00。",
  },
  {
    category: "購車相關",
    question: "崑家汽車的二手車有保固嗎？",
    answer: "是的，崑家汽車所有車輛皆通過第三方認證，確保車況透明、品質可靠。詳細保固條款請洽門市或 LINE 官方帳號詢問。",
  },
  {
    category: "購車相關",
    question: "可以預約看車嗎？",
    answer: "可以，您可以透過 LINE 官方帳號 @825oftez 預約看車，或直接到店賞車。外縣市客戶也可在預約後安排免費接駁。",
  },
  {
    category: "購車相關",
    question: "外縣市可以買車嗎？",
    answer: "可以，崑家汽車提供台中以南外縣市免費接駁服務，讓您輕鬆到店看車。",
  },
  {
    category: "購車相關",
    question: "交車需要多久？",
    answer: "崑家汽車最快3小時即可完成交車手續，讓您當天就能開車回家。實際時間視貸款審核與過戶進度而定。",
  },
  {
    category: "購車相關",
    question: "舊車可以折抵嗎？",
    answer: "可以，崑家汽車提供舊車高價收購服務，歡迎以舊換新，降低您的換車成本。",
  },
  {
    category: "購車相關",
    question: "可以帶自己的驗車師傅來嗎？",
    answer: "非常歡迎！崑家汽車歡迎買家自行攜帶驗車師傅到場驗車，我們對每台車的車況有十足信心。",
  },
  {
    category: "購車相關",
    question: "二手車可以議價嗎？",
    answer: "可以，但幅度有限。崑家汽車的標價已是合理市場價，合理議價範圍約在標價的 3%-5%。",
  },
  // 第三方認證
  {
    category: "第三方認證",
    question: "什麼是第三方認證？",
    answer: "第三方認證是由獨立於買賣雙方的專業機構，對車輛進行全面檢查並出具書面報告。涵蓋車身鈑金、引擎、底盤、電子系統、里程真偽等項目，是保障買家權益最有效的方式。",
  },
  {
    category: "第三方認證",
    question: "認證費用誰出？",
    answer: "崑家汽車已將認證費用包含在整備成本內，買家無需額外支付任何認證費用。",
  },
  {
    category: "第三方認證",
    question: "認證報告能保證車輛不會出問題嗎？",
    answer: "認證報告呈現的是驗車當下的車況，無法保證未來不會出現機械故障，但它大幅降低了買到問題車的風險。",
  },
  // 貸款相關
  {
    category: "貸款相關",
    question: "二手車可以貸款嗎？",
    answer: "可以，崑家汽車有專業貸款團隊，合作多家銀行與貸款機構，提供多種貸款方案。一般貸款成數為車價的 50%-80%，依車齡和個人信用而定。",
  },
  {
    category: "貸款相關",
    question: "沒有薪資轉帳也可以貸款嗎？",
    answer: "可以，但需要提供其他收入證明，或由有薪資轉帳的保人共同申請。建議先諮詢崑家汽車的貸款專員評估。",
  },
  {
    category: "貸款相關",
    question: "信用有瑕疵還能貸款嗎？",
    answer: "仍有機會，但利率會偏高，且核准成數可能較低。崑家汽車合作多家金融機構，可協助評估最適方案。",
  },
  {
    category: "貸款相關",
    question: "貸款審核需要多久？",
    answer: "崑家汽車的貸款專員會協助準備所有文件並代為送件，最快一個工作天即可獲得核准通知。",
  },
  // 過戶相關
  {
    category: "過戶相關",
    question: "過戶流程怎麼走？",
    answer: "標準流程為：準備文件 → 前往監理站（或委託代辦）→ 填寫異動申請書 → 繳交規費 → 領取新行照。崑家汽車提供代辦服務，一般 1-2 個工作天即可完成。",
  },
  {
    category: "過戶相關",
    question: "過戶費用多少？",
    answer: "過戶規費約 150-200 元，加上燃料費、牌照稅按月分攤、強制險轉讓或重新投保費用。崑家汽車代辦過戶不額外收取手續費。",
  },
  {
    category: "過戶相關",
    question: "過戶後車牌要換嗎？",
    answer: "不需要，車牌跟著車走，不跟著人走。只有車主更名、遷址等特殊情況才需要辦理。",
  },
  // 高雄二手車市場
  {
    category: "高雄二手車",
    question: "高雄的二手車比台北便宜嗎？",
    answer: "一般而言，相同車況的二手車在高雄的售價會比台北低約 3%-8%，主要因為運費成本與市場需求差異。",
  },
  {
    category: "高雄二手車",
    question: "高雄哪裡買二手車比較好？",
    answer: "高雄主要的二手車商圈集中在三民區、左營區與苓雅區。其中三民區大順路一帶是傳統汽車街，聚集了數十家車行。崑家汽車就位於三民區大順二路269號，是在地40年的老字號。",
  },
  {
    category: "高雄二手車",
    question: "崑家汽車有哪些品牌的車？",
    answer: "崑家汽車常見品牌涵蓋 Toyota、Honda、BMW、Benz、Mazda、Nissan、Ford、Volkswagen 等。車款每週更新，建議透過 LINE 詢問最新庫存。",
  },
];

const CATEGORIES = Array.from(new Set(FAQ_DATA.map((f) => f.category)));

function FaqAccordion({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 py-4 text-left hover:bg-muted/30 px-4 -mx-4 transition-colors"
      >
        <HelpCircle className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1">
          <h3 className={`faq-question text-sm font-medium ${isOpen ? "text-primary" : "text-foreground"}`} data-speakable>
            {item.question}
          </h3>
          {isOpen && (
            <p className="faq-answer mt-2 text-sm text-muted-foreground leading-relaxed" data-speakable>
              {item.answer}
            </p>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 mt-0.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
      </button>
    </div>
  );
}

export default function FaqPage() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#303d4e] text-white">
        <div className="container py-6">
          <a href="/" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white/90 mb-3 transition-colors">
            ← 回到首頁
          </a>
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="h-6 w-6 text-[#C4A265]" />
            <h1 className="text-2xl font-bold">常見問題 FAQ｜崑家汽車</h1>
          </div>
          <p className="text-sm text-white/70 max-w-2xl">
            買二手車常見問題一次解答：購車、貸款、認證、過戶、高雄二手車市場資訊。找不到答案？直接 LINE 問我們。
          </p>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container py-2">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <a href="/" className="hover:text-foreground transition-colors">首頁</a>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">常見問題</span>
          </nav>
        </div>
      </div>

      {/* FAQ Content */}
      <main className="container py-8">
        <div className="max-w-3xl mx-auto">
          {CATEGORIES.map((category) => {
            const items = FAQ_DATA.filter((f) => f.category === category);
            return (
              <section key={category} className="mb-10">
                <h2 className="text-lg font-bold text-foreground mb-4 pb-2 border-b">
                  {category}
                </h2>
                <div>
                  {items.map((item) => {
                    const globalIndex = FAQ_DATA.indexOf(item);
                    return (
                      <FaqAccordion
                        key={globalIndex}
                        item={item}
                        isOpen={openItems.has(globalIndex)}
                        onToggle={() => toggle(globalIndex)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Cross-links */}
          <div className="mt-12 rounded-xl border bg-muted/30 p-6">
            <h2 className="text-sm font-bold mb-4">延伸閱讀</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <a href="/blog/buy-used-car-guide" className="text-xs text-primary hover:underline">
                買二手車必看！7大注意事項完整指南
              </a>
              <a href="/blog/used-car-loan-guide" className="text-xs text-primary hover:underline">
                二手車貸款全攻略（2026年最新）
              </a>
              <a href="/blog/third-party-inspection-guide" className="text-xs text-primary hover:underline">
                二手車第三方認證完整指南
              </a>
              <a href="/blog/used-car-transfer-guide" className="text-xs text-primary hover:underline">
                二手車過戶流程與費用指南
              </a>
              <a href="/blog/kaohsiung-used-car-guide" className="text-xs text-primary hover:underline">
                高雄買二手車推薦：崑家汽車評價
              </a>
              <a href="/" className="text-xs text-primary hover:underline">
                瀏覽全部在售車輛
              </a>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 rounded-2xl bg-[#303d4e] p-6 text-white text-center">
            <h2 className="text-lg font-bold mb-2">還有其他問題？</h2>
            <p className="text-sm text-white/70 mb-4">
              崑家汽車40年經驗，透過 LINE 免費諮詢，不收任何費用
            </p>
            <a
              href="https://page.line.me/825oftez"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#05b04c] transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              LINE 免費諮詢
            </a>
          </div>
        </div>
      </main>

      <SeoFooter />
    </div>
  );
}
