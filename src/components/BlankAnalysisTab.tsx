import { AlertTriangle, CheckCircle2, Info, Ruler } from 'lucide-react';
import {
  calculateBlankAnalysis,
  evaluateSplitRecommendation,
  SHEET_STANDARD_WIDTH,
  SPLIT_MODE_LABELS,
} from '../domain/ductRules';
import type { DuctConfig } from '../types/duct';

interface BlankAnalysisTabProps {
  config: DuctConfig;
}

export function BlankAnalysisTab({ config }: BlankAnalysisTabProps) {
  const pieces = calculateBlankAnalysis(config);
  const rec = evaluateSplitRecommendation(config.W, config.H, config.L);

  const totalArea = pieces.reduce((sum, p) => sum + p.areaM2, 0);
  const totalWeight = pieces.reduce((sum, p) => sum + p.weightKg, 0);
  const anyExceeds = pieces.some((p) => p.cutOrientation === 'can_noi_c');

  return (
    <div className="space-y-4 pb-5">
      {/* KPI Summary */}
      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#232e40] bg-[#151c27] p-2.5">
          <div className="text-[10px] font-medium text-slate-400 uppercase">Tổng diện tích phôi</div>
          <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-sky-300">
            {totalArea.toFixed(2)} <span className="text-xs font-normal text-slate-400">m²</span>
          </div>
        </div>
        <div className="rounded-lg border border-[#232e40] bg-[#151c27] p-2.5">
          <div className="text-[10px] font-medium text-slate-400 uppercase">Khối lượng tôn ước tính</div>
          <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-100">
            {totalWeight.toFixed(2)} <span className="text-xs font-normal text-slate-400">kg</span>
          </div>
        </div>
      </section>

      {/* Sheet Standard Status */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Kiểm tra quy chuẩn khổ tôn {SHEET_STANDARD_WIDTH} mm
        </h2>
        <div
          className={`rounded-lg border p-2.5 text-[11px] leading-relaxed ${
            anyExceeds
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {anyExceeds ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <div>
              <div className="font-semibold">
                {anyExceeds
                  ? 'Có mảnh vượt khổ tôn chuẩn 1200 mm'
                  : `Tất cả ${pieces.length} mảnh tối ưu trên tấm 6000 × 1200 mm`}
              </div>
              <div className="mt-0.5 text-slate-300">
                Kiểu chia hiện tại: <strong>{SPLIT_MODE_LABELS[config.splitMode]}</strong>
                {config.splitMode !== rec.recommended && (
                  <span className="text-amber-300">
                    {' '}
                    (Hệ thống đề xuất: {SPLIT_MODE_LABELS[rec.recommended]})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {config.L < 140 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-2.5 py-2 text-[11px] text-amber-200">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              Chiều dài L = {config.L} mm &lt; 140 mm: Gợi ý cân nhắc chuyển sang Mí hàn (vẫn tùy
              chọn tự do).
            </span>
          </div>
        )}
      </section>

      {/* Per-piece Blank Table */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <Ruler className="h-3.5 w-3.5 shrink-0" />
            <span>Bảng phôi ({pieces.length} mảnh)</span>
          </h2>
          <span className="shrink-0 font-mono text-[10px] text-slate-400">Đơn vị: mm</span>
        </div>

        <div className="space-y-2">
          {pieces.map((p, idx) => (
            <div
              key={p.id}
              className="rounded-lg border border-[#232e40] bg-[#141b26] p-2.5 text-[11px]"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div className="font-semibold text-slate-100">
                  #{idx + 1} {p.name}
                </div>
                <span className="rounded bg-[#1e2a3c] px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                  {p.bendCount} đường chấn
                </span>
              </div>

              <div className="mb-2 flex items-center justify-between rounded bg-[#0d121a] px-2 py-1.5 font-mono">
                <span className="text-slate-400">Kích thước phôi:</span>
                <span className="font-semibold text-slate-100">
                  {p.developedWidth} × {p.blankLength} mm
                </span>
              </div>

              <div className="space-y-1 text-[10.5px] text-slate-400">
                <div className="flex justify-between">
                  <span>Thân ({p.wallsLabel}):</span>
                  <span className="font-mono text-slate-200">{p.wallSpanSum} mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Mép đầu 1 ({p.startSeamLabel}):</span>
                  <span className="font-mono text-slate-200">+{p.startAllowance} mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Mép đầu 2 ({p.endSeamLabel}):</span>
                  <span className="font-mono text-slate-200">+{p.endAllowance} mm</span>
                </div>
                <div className="flex justify-between border-t border-[#1f2938] pt-1">
                  <span>Diện tích / Khối lượng:</span>
                  <span className="font-mono text-slate-200">
                    {p.areaM2.toFixed(2)} m² • {p.weightKg.toFixed(2)} kg
                  </span>
                </div>
              </div>

              <div
                className={`mt-2 rounded px-2 py-1 text-[10px] font-medium ${
                  p.cutOrientation === 'can_noi_c'
                    ? 'bg-amber-500/15 text-amber-300'
                    : p.cutOrientation === 'doc_6000x1200'
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'bg-emerald-500/12 text-emerald-300'
                }`}
              >
                {p.cutNote}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
