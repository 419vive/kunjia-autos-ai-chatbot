import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { Car, X, Gauge, Fuel, Calendar, ArrowRight, Phone } from "lucide-react";

const MAX_COMPARE = 3;

/** Get/set compare list in localStorage */
function getCompareIds(): number[] {
  try {
    const raw = localStorage.getItem("kun-compare-ids");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setCompareIds(ids: number[]) {
  localStorage.setItem("kun-compare-ids", JSON.stringify(ids.slice(0, MAX_COMPARE)));
}

/** Hook for compare list */
export function useCompareList() {
  const [ids, setIds] = useState<number[]>(getCompareIds);

  const toggle = (id: number) => {
    setIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, MAX_COMPARE);
      setCompareIds(next);
      return next;
    });
  };

  const clear = () => { setIds([]); setCompareIds([]); };
  const has = (id: number) => ids.includes(id);

  return { ids, toggle, clear, has, count: ids.length };
}

/** Floating compare bar shown on Home page */
export function CompareBar({ ids, onClear }: { ids: number[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);

  if (ids.length === 0) return null;

  return (
    <>
      {/* Floating bar */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-primary px-5 py-2.5 text-primary-foreground shadow-xl">
        <span className="text-sm font-medium">{ids.length} 台車待比較</span>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold hover:bg-white/30 transition-colors"
        >
          開始比較
        </button>
        <button onClick={onClear} className="rounded-full p-1 hover:bg-white/20 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Compare modal */}
      {open && (
        <CompareModal ids={ids} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** Full-screen compare modal */
function CompareModal({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const { data: allVehicles } = trpc.vehicle.list.useQuery();

  const vehicles = useMemo(() => {
    if (!allVehicles) return [];
    return ids.map(id => allVehicles.find(v => v.id === id)).filter(Boolean) as any[];
  }, [allVehicles, ids]);

  // Spec rows to compare
  const specRows = useMemo(() => {
    if (vehicles.length === 0) return [];
    return [
      { label: "售價", key: "price", format: (v: any) => v.priceDisplay || `${v.price}萬` },
      { label: "年份", key: "modelYear", format: (v: any) => v.modelYear ? `${v.modelYear}年` : "-" },
      { label: "里程", key: "mileage", format: (v: any) => v.mileage || "-" },
      { label: "排氣量", key: "displacement", format: (v: any) => v.displacement || "-" },
      { label: "變速箱", key: "transmission", format: (v: any) => v.transmission || "-" },
      { label: "燃料", key: "fuelType", format: (v: any) => v.fuelType || "-" },
      { label: "顏色", key: "color", format: (v: any) => v.color || "-" },
      { label: "車型", key: "bodyType", format: (v: any) => v.bodyType || "-" },
    ];
  }, [vehicles]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-8 sm:pt-16 px-4 overflow-y-auto">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            車輛比較 ({vehicles.length} 台)
          </h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">載入中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Vehicle photos + names */}
              <thead>
                <tr>
                  <th className="w-28 sm:w-36 p-3 text-left text-xs font-medium text-muted-foreground align-top">車款</th>
                  {vehicles.map((v: any) => {
                    const photos = v.photoUrls?.split("|").filter((u: string) => u.trim()) || [];
                    return (
                      <th key={v.id} className="p-3 align-top min-w-[160px]">
                        <div className="rounded-xl overflow-hidden mb-2 aspect-[16/10] bg-muted">
                          {photos[0] ? (
                            <ProgressiveImage src={photos[0]} alt={`${v.brand} ${v.model}`} containerClassName="w-full h-full" aspectRatio="16/10" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Car className="h-8 w-8 text-muted-foreground/30" /></div>
                          )}
                        </div>
                        <p className="font-bold text-sm">{v.brand} {v.model}</p>
                        <p className="text-primary font-bold text-base mt-0.5">{v.priceDisplay || `${v.price}萬`}</p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {specRows.map((row, i) => (
                  <tr key={row.key} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <td className="px-3 py-2.5 text-xs font-medium text-muted-foreground">{row.label}</td>
                    {vehicles.map((v: any) => (
                      <td key={v.id} className="px-3 py-2.5 text-sm">{row.format(v)}</td>
                    ))}
                  </tr>
                ))}
                {/* Features row (special) */}
                <tr className={specRows.length % 2 === 0 ? "bg-muted/30" : ""}>
                  <td className="px-3 py-2.5 text-xs font-medium text-muted-foreground">配備</td>
                  {vehicles.map((v: any) => (
                    <td key={v.id} className="px-3 py-2.5 text-xs leading-relaxed">
                      {v.features ? v.features.split(",").slice(0, 6).join("、") : "-"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* CTA footer */}
        <div className="flex flex-wrap items-center justify-center gap-3 px-6 py-4 border-t bg-muted/20">
          <a
            href="tel:0936812818"
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Phone className="h-4 w-4" />
            打電話問阿家
          </a>
          <a
            href="https://page.line.me/825oftez"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[#06C755] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#05b04c] transition-colors"
          >
            LINE 問車
          </a>
        </div>
      </div>
    </div>
  );
}
