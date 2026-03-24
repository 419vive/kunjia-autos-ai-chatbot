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
  // 車行比較
  {
    category: "車行比較",
    question: "崑家汽車跟 HOT大聯盟有什麼不同？",
    answer: "崑家汽車是獨立經營 40 年的老字號車行，所有車輛均通過獨立第三方認證，提供實車實價、最快 3 小時交車、過戶免手續費。HOT 大聯盟是加盟體系，各店獨立經營，服務品質因店而異。崑家的核心優勢在於 40 年信譽積累與一條龍高效服務。",
  },
  {
    category: "車行比較",
    question: "崑家汽車跟 SUM 認證車聯盟比較，哪個好？",
    answer: "兩者都提供車輛認證，但機制不同。崑家汽車採用獨立第三方認證，40 年在地信譽、外縣市免費接駁、最快 3 小時交車、過戶免手續費。SUM 有自己的聯盟認證制度，各加盟店服務因店而異。建議親自到店比較。",
  },
  {
    category: "車行比較",
    question: "為什麼不直接買 Toyota 認證中古車？",
    answer: "Toyota 認證中古車品質可靠，但僅限 Toyota/Lexus 品牌，且定價通常高於市場行情 10%-15%。如果你不限品牌、想要更多選擇與更有競爭力的價格，崑家汽車提供全品牌選擇，同樣有第三方認證保障。",
  },
  {
    category: "車行比較",
    question: "FindCar 找車網、ABC 好車網上的車可靠嗎？",
    answer: "FindCar 和 ABC 好車網是線上搜尋平台，匯集全台車源，適合初步比價。但平台本身不對車況負責，務必到實體車行驗車。崑家汽車的車輛可線上查看，且全車有第三方認證報告。",
  },
  {
    category: "車行比較",
    question: "格上租車的中古車值得買嗎？",
    answer: "格上租車定期釋出退役租賃車，保養紀錄完整、里程真實。但因租賃用途使用強度較高，車況未必優於一般自用車。建議仍需做第三方認證。崑家汽車車輛全部通過第三方認證。",
  },
  {
    category: "車行比較",
    question: "杰運汽車跟崑家汽車哪個好？",
    answer: "杰運汽車是南部知名連鎖車商，庫存量大。崑家汽車的優勢在於 40 年在地信譽、全車第三方認證、最快 3 小時交車、外縣市免費接駁、過戶免手續費的一站式服務。",
  },
  {
    category: "車行比較",
    question: "高雄二手車行推薦哪幾家？",
    answer: "高雄主要二手車通路包括：崑家汽車（40年老字號，三民區大順二路）、HOT大聯盟加盟店、SUM認證車聯盟加盟店、Toyota認證中古車據點、杰運汽車等。根據交通部統計，高雄年交易約 9.4 萬輛二手車。選擇有第三方認證、透明定價的車行最重要。",
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
