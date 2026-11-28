import { AlertTriangle, CheckCircle2, Info, Ruler } from 'lucide-react';
import {
  calculateBlankAnalysis,
  evaluateSplitForConfig,
  SHEET_MATERIAL_LABELS,
  SPLIT_MODE_LABELS,
} from '../../../core/rules/ductRules';
import { getEndAllowanceLabel, getEndAllowanceMm } from '../../../core/rules/endConnectionRules';
import { getActiveSheetDimensions } from '../../../core/rules/workshopSettings';
import type { DuctConfig, WorkshopSettings } from '../../../core/types/duct';
import type { FlatPatternDocument } from '../../../core/types/flatPattern2d';

interface BlankAnalysisTabProps {
  config: DuctConfig;
  workshopSettings: WorkshopSettings;
  flatPatternDoc: FlatPatternDocument;
  selectedPartCode: string | null;
  onSelectPart: (partCode: string | null) => void;
  onOpenPartInspector: (partCode: string) => void;
}

export function BlankAnalysisTab({
  config,
  workshopSettings,
  flatPatternDoc,
  selectedPartCode,
  onSelectPart,
  onOpenPartInspector,
}: BlankAnalysisTabProps) {
  const pieces = calculateBlankAnalysis(config, workshopSettings, flatPatternDoc);
  const { widthMm: sheetWidth, lengthMm: sheetLength } = getActiveSheetDimensions(
    config.sheetMaterial,
    workshopSettings
  );
  const matLabel = SHEET_MATERIAL_LABELS[config.sheetMaterial];
  const rec = evaluateSplitForConfig(
    config.W,
    config.H,
    config.L,
    config.sheetMaterial,
    config.c1,
    config.c2,
    workshopSettings
  );

  const c1Allow = getEndAllowanceMm(config.c1);
  const c2Allow = getEndAllowanceMm(config.c2);
  const blankLength = config.L + c1Allow + c2Allow;

  const totalArea = pieces.reduce((sum, p) => sum + p.areaM2, 0);
  const anyExceeds = pieces.some((p) => p.cutOrientation === 'can_noi_c');
  const anyOverlap2D = pieces.some((p) => p.hasOverlap2D);
  const anyRollFormer =
    config.stiffenerRibs &&
    config.L >= 220 &&
    pieces.some((p) => !p.isEndCap && p.blankLength > workshopSettings.rollFormerLimitMm);
  const endCapCount = pieces.filter((p) => p.isEndCap).length;
  const mergedCount = pieces.filter((p) => p.isMergedTree).length;

  return (
    <div className="space-y-4 pb-5">
      {/* KPI Summary: Tổng diện tích phôi + Khổ vật liệu chuẩn — KHÔNG tính kg */}
      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#232e40] bg-[#151c27] p-2.5">
          <div className="text-[10px] font-medium text-slate-400 uppercase">
            Tổng diện tích phôi
          </div>
          <div
            id="kpi-total-area"
            className="mt-0.5 font-mono text-base font-semibold tabular-nums text-sky-300"
          >
            {totalArea.toFixed(2)} <span className="text-xs font-normal text-slate-400">m²</span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-slate-400">
            {mergedCount > 0
              ? `${pieces.length} mảnh (${mergedCount} mảnh gộp)`
              : endCapCount > 0
                ? `${pieces.length - endCapCount} thân + ${endCapCount} bịt đầu`
                : `${pieces.length} mảnh thân ống`}
          </div>
        </div>
        <div
          id="kpi-sheet-width"
          className="rounded-lg border border-[#232e40] bg-[#151c27] p-2.5"
        >
          <div className="text-[10px] font-medium text-slate-400 uppercase">
            Khổ tấm chuẩn
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-100">
            {sheetWidth}×{sheetLength}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-slate-400">{matLabel} (mm)</div>
        </div>
      </section>

      {/* Orange 2D Overlap Alert when a Free-Merge custom spanning tree overlaps in 2D */}
      {anyOverlap2D && (
        <section
          id="blank-overlap-warning"
          className="rounded-lg border border-orange-500/50 bg-orange-500/12 p-2.5 text-[11px] leading-snug text-orange-200"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div>
              <div className="font-semibold text-orange-100">
                Phát hiện vùng phôi 2D chồng lấn khi trải phẳng
              </div>
              <p className="mt-0.5 text-[10.5px] text-orange-200/90">
                Kiểu ghép mảnh tự do hiện tại có các mặt đè lên nhau trên mặt phẳng 2D (đã tô viền
                cam). Hãy đổi cạnh liền mảnh khác hoặc tách bớt cạnh trước khi xuất DXF cắt Laser.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Dynamic Blank Length Breakdown: L_phôi = L + bù C1 + bù C2 */}
      <section className="rounded-lg border border-[#223044] bg-[#0e1520] p-2.5 text-[11px]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-semibold text-slate-300">Chiều dài phôi thân (L phôi)</span>
          <span
            id="kpi-blank-length"
            className={`font-mono text-xs font-bold tabular-nums ${
              anyExceeds ? 'text-red-300' : anyRollFormer ? 'text-amber-300' : 'text-sky-300'
            }`}
          >
            {blankLength} mm
          </span>
        </div>
        <div className="space-y-0.5 text-[10.5px] text-slate-400">
          <div className="flex justify-between">
            <span>Chiều dài thân ống (L):</span>
            <span className="font-mono text-slate-200">{config.L} mm</span>
          </div>
          <div className="flex justify-between">
            <span>Kết nối 1 — {getEndAllowanceLabel(config.c1)}:</span>
            <span className="font-mono text-slate-200">+{c1Allow} mm</span>
          </div>
          <div className="flex justify-between">
            <span>Kết nối 2 — {getEndAllowanceLabel(config.c2)}:</span>
            <span className="font-mono text-slate-200">+{c2Allow} mm</span>
          </div>
        </div>
      </section>

      {/* Sheet Standard Status (allows 0° or 90° rotation) */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Kiểm tra khổ tấm {sheetWidth}×{sheetLength} mm
        </h2>
        <div
          id="sheet-limit-summary"
          className={`rounded-lg border p-2.5 text-[11px] leading-relaxed ${
            anyExceeds
              ? 'border-red-500/45 bg-red-500/10 text-red-200'
              : anyRollFormer
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {anyExceeds || anyRollFormer ? (
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  anyExceeds ? 'text-red-400' : 'text-amber-400'
                }`}
              />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <div>
              <div className="font-semibold">
                {anyExceeds
                  ? `Có mảnh vượt khổ tấm ${sheetWidth}×${sheetLength} mm`
                  : anyRollFormer
                    ? `Đạt khổ tấm, nhưng L phôi vượt khổ máy lăn gân ${workshopSettings.rollFormerLimitMm} mm`
                    : `Đạt — Tất cả ${pieces.length} mảnh lọt tấm ${sheetWidth}×${sheetLength} mm`}
              </div>
              <div className="mt-0.5 text-slate-300">
                Kiểu chia hiện tại:{' '}
                <strong>
                  {config.freeMergeMode
                    ? 'Chế độ ghép mảnh tự do'
                    : SPLIT_MODE_LABELS[config.splitMode]}
                </strong>
                {!config.freeMergeMode && config.splitMode !== rec.recommended && (
                  <span className="text-sky-300">
                    {' '}
                    (Đề xuất: {SPLIT_MODE_LABELS[rec.recommended]})
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

      {/* Per-piece Blank Table with Part Codes (1-A, 1-B, 1-C, 1-D, 1-E...) */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <Ruler className="h-3.5 w-3.5 shrink-0" />
            <span>Bảng phôi ({pieces.length} mảnh)</span>
          </h2>
          <span className="shrink-0 font-mono text-[10px] text-slate-400">Đơn vị: mm</span>
        </div>

        <div className="space-y-2">
          {pieces.map((p) => {
            const isSelected = selectedPartCode === p.partCode;
            return (
              <div
                key={p.id}
                data-piece-id={p.id}
                data-part-code={p.partCode}
                onClick={() => onSelectPart(p.partCode)}
                onDoubleClick={() => onOpenPartInspector(p.partCode)}
                className={`cursor-pointer rounded-lg border p-2.5 text-[11px] transition-colors ${
                  p.hasOverlap2D
                    ? 'border-orange-500/65 bg-orange-500/8'
                    : isSelected
                      ? 'border-sky-400 bg-sky-500/12 ring-1 ring-sky-400/40'
                      : p.isEndCap || p.isMergedTree
                        ? 'border-sky-500/40 bg-[#131d2c] hover:border-sky-400/60'
                        : 'border-[#232e40] bg-[#141b26] hover:border-[#344662]'
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                    <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-sky-300 ring-1 ring-sky-500/35">
                      {p.partCode}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      p.isMergedTree
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : p.isEndCap
                          ? 'bg-sky-500/20 text-sky-200'
                          : 'bg-[#1e2a3c] text-sky-300'
                    }`}
                  >
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
                  {p.isMergedTree ? (
                    <>
                      <div className="flex justify-between">
                        <span>Các mặt gộp liền:</span>
                        <span className="font-mono text-emerald-200">{p.wallsLabel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Khung bao trải phẳng 2D:</span>
                        <span className="font-mono text-slate-200">
                          {p.developedWidth} × {p.blankLength} mm
                        </span>
                      </div>
                    </>
                  ) : p.isEndCap ? (
                    <>
                      <div className="flex justify-between">
                        <span>Mặt bịt (W × H):</span>
                        <span className="font-mono text-slate-200">
                          {config.W} × {config.H} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Trái / Phải:</span>
                        <span className="font-mono text-slate-200">
                          +{p.startAllowance} / +{p.endAllowance} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Trên / Dưới:</span>
                        <span className="font-mono text-slate-200">
                          +{p.c1Allowance} / +{p.c2Allowance} mm
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Thân ({p.wallsLabel}):</span>
                        <span className="font-mono text-slate-200">{p.wallSpanSum} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mép dọc 1 ({p.startSeamLabel}):</span>
                        <span className="font-mono text-slate-200">+{p.startAllowance} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mép dọc 2 ({p.endSeamLabel}):</span>
                        <span className="font-mono text-slate-200">+{p.endAllowance} mm</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Chiều dài phôi:</span>
                        <span className="shrink-0 font-mono text-slate-200">
                          {p.baseLength}+{p.c1Allowance}+{p.c2Allowance} = {p.blankLength} mm
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t border-[#1f2938] pt-1">
                    <span>Diện tích:</span>
                    <span className="font-mono font-medium text-sky-300">
                      {p.areaM2.toFixed(2)} m²
                    </span>
                  </div>
                </div>

                {p.hasOverlap2D && (
                  <div className="mt-2 rounded bg-orange-500/20 px-2 py-1 text-[10px] font-semibold text-orange-200">
                    ⚠ {p.overlapWarning ?? 'Trùng vùng phôi 2D — hãy đổi cạnh ghép'}
                  </div>
                )}

                <div
                  className={`mt-2 rounded px-2 py-1 text-[10px] font-medium ${
                    p.cutOrientation === 'can_noi_c'
                      ? 'bg-red-500/15 text-red-200'
                      : 'bg-emerald-500/12 text-emerald-300'
                  }`}
                >
                  {p.cutNote}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
