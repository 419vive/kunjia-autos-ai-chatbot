import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Car, Phone, CheckCircle2, Loader2, X } from "lucide-react";
import { useFormAutosave } from "@/hooks/useFormAutosave";

type FormData = {
  customerName: string;
  phone: string;
  gender: string;
  age: string;
  hasLicense: string;
  employmentType: string;
  employmentDuration: string;
  hasInsurance: string;
  previousLoans: string;
  purchaseMethod: string;
  notes: string;
};

const initialForm: FormData = {
  customerName: "",
  phone: "",
  gender: "",
  age: "",
  hasLicense: "",
  employmentType: "",
  employmentDuration: "",
  hasInsurance: "",
  previousLoans: "",
  purchaseMethod: "",
  notes: "",
};

function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </legend>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function LoanInquiry() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const vehicleId = params.get("vehicleId");
  const vehicleName = params.get("vehicle") || "";

  const [form, setForm] = useState<FormData>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);

  // Auto-save form data to sessionStorage
  const autosaveData = useMemo(() => ({
    ...form,
    vehicleId: vehicleId || "",
    vehicleName,
  }), [form, vehicleId, vehicleName]);

  const { restoredData, clearDraft } = useFormAutosave("kunjia_loan_draft", autosaveData);

  // Restore draft on mount
  useEffect(() => {
    if (restoredData) {
      const { vehicleId: _vid, vehicleName: _vn, ...formFields } = restoredData as Record<string, string>;
      const restored: Partial<FormData> = {};
      for (const key of Object.keys(initialForm) as (keyof FormData)[]) {
        if (formFields[key]) restored[key] = formFields[key];
      }
      if (Object.keys(restored).length > 0) {
        setForm((prev) => ({ ...prev, ...restored }));
        setShowRestoreBanner(true);
      }
    }
  }, [restoredData]);

  const mutation = trpc.loan.submit.useMutation({
    onSuccess: () => {
      clearDraft();
      setSubmitted(true);
    },
  });

  const update = (field: keyof FormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Validate phone: Taiwan mobile (09xxxxxxxx) or LINE ID (any non-empty string)
  const isPhoneValid = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-]/g, "");
    // Accept Taiwan mobile format or LINE ID (at least 3 chars)
    return /^09\d{8}$/.test(cleaned) || cleaned.length >= 3;
  };

  const [phoneError, setPhoneError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.phone) return;
    if (!isPhoneValid(form.phone)) {
      setPhoneError("請輸入正確的手機號碼（09開頭10碼）或 LINE ID");
      return;
    }
    setPhoneError("");
    mutation.mutate({
      vehicleId: vehicleId ? Number(vehicleId) : undefined,
      vehicleName: vehicleName || undefined,
      ...form,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm mx-auto space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold">已收到您的貸款諮詢！</h1>
          <p className="text-muted-foreground text-sm">
            我們的專業銷售人員會盡快與您聯繫，為您提供最適合的貸款方案。
          </p>
          {vehicleName && (
            <p className="text-sm text-primary font-medium">
              詢問車輛：{vehicleName}
            </p>
          )}
          <div className="pt-2 space-y-2">
            <a
              href="tel:0936812818"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Phone className="h-4 w-4" />
              直接撥打 0936-812-818
            </a>
            <a
              href="https://page.line.me/825oftez"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#06C755] px-4 py-3 text-sm font-semibold text-white hover:bg-[#05b04c] transition-colors"
            >
              LINE 聯繫我們
            </a>
            <a
              href="/"
              className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              返回首頁看更多車輛
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-primary text-primary-foreground">
        <div className="container flex h-14 items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Car className="h-5 w-5" />
            <span className="font-semibold">崑家汽車</span>
          </a>
          <a
            href="tel:0936812818"
            className="flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25 transition-colors"
          >
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">0936-812-818</span>
          </a>
        </div>
      </header>

      <div className="container max-w-lg mx-auto py-6 px-4">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">💰 貸款利率評估表</h1>
          <p className="text-sm text-muted-foreground mt-1">
            填寫以下資料，我們會盡快為您評估最佳貸款方案
          </p>
          {vehicleName && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Car className="h-3.5 w-3.5" />
              {vehicleName}
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-6 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1">🔒 資料保密</span>
          <span className="rounded-full bg-muted px-2.5 py-1">✅ 免費評估</span>
          <span className="rounded-full bg-muted px-2.5 py-1">⚡ 快速回覆</span>
        </div>

        {/* Draft restored banner */}
        {showRestoreBanner && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 mb-4 flex items-center justify-between text-sm text-blue-700 animate-in slide-in-from-top-2 duration-300">
            <span>已恢復上次填寫的資料 ✓</span>
            <button
              type="button"
              onClick={() => setShowRestoreBanner(false)}
              className="ml-2 p-0.5 rounded hover:bg-blue-100 transition-colors"
              aria-label="關閉"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium">
              您的姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.customerName}
              onChange={(e) => update("customerName")(e.target.value)}
              placeholder="請輸入您的姓名"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium">
              聯繫電話 / LINE <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => update("phone")(e.target.value)}
              placeholder="手機號碼或 LINE ID"
              className={`mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${phoneError ? "border-red-500" : ""}`}
            />
            {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
          </div>

          {/* Gender */}
          <RadioGroup
            label="您的性別"
            name="gender"
            options={["男", "女"]}
            value={form.gender}
            onChange={update("gender")}
          />

          {/* Age */}
          <div>
            <label className="text-sm font-medium">您的年紀</label>
            <input
              type="text"
              value={form.age}
              onChange={(e) => update("age")(e.target.value)}
              placeholder="例如：28"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* License */}
          <RadioGroup
            label="是否有汽車駕照"
            name="hasLicense"
            options={["有", "沒有"]}
            value={form.hasLicense}
            onChange={update("hasLicense")}
          />

          {/* Employment */}
          <RadioGroup
            label="目前的工作是否有勞工保險或是薪資轉帳"
            name="employmentType"
            options={["有勞保, 有薪轉", "有勞保, 領現金", "無勞保, 領現金"]}
            value={form.employmentType}
            onChange={update("employmentType")}
          />

          {/* Work duration */}
          <div>
            <label className="text-sm font-medium">
              請問您目前有工作嗎？工作多長時間了？
            </label>
            <input
              type="text"
              value={form.employmentDuration}
              onChange={(e) => update("employmentDuration")(e.target.value)}
              placeholder="例如：目前在XX公司，做了3年"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Previous loans */}
          <RadioGroup
            label="曾經或現在是否有辦過任何貸款"
            name="previousLoans"
            options={["沒有", "有，正常繳款中", "有，已繳清", "有，有遲繳紀錄"]}
            value={form.previousLoans}
            onChange={update("previousLoans")}
          />

          {/* Purchase method */}
          <RadioGroup
            label="請問您要如何購車"
            name="purchaseMethod"
            options={["現金購買", "有頭款其餘貸款", "全額貸", "超貸拿現金", "私分購車"]}
            value={form.purchaseMethod}
            onChange={update("purchaseMethod")}
            required
          />

          {/* Info box */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p>✨ 確定車款才會做後續處理</p>
            <p>🙋 信用瑕疵、信用小白也可以評估看看哦！有評估有機會</p>
            <p>💪 除了銀行還有配合其他管道</p>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">其他備註</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes")(e.target.value)}
              placeholder="有什麼想補充的都可以寫在這裡..."
              rows={3}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending || !form.customerName || !form.phone}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              "送出貸款評估申請"
            )}
          </button>

          {mutation.isError && (
            <p className="text-center text-sm text-red-500">
              提交失敗，請稍後再試或直接撥打 0936-812-818
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            此表單僅供線上貸款評估使用，請您放心 ❤️
          </p>
        </form>
      </div>
    </div>
  );
}
