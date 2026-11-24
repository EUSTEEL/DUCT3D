import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Flame,
  Info,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  computeRibLayout,
  DUCT_PRESETS,
  evaluateSplitRecommendation,
  resolveActiveSeams,
  WALL_LABELS,
} from '../domain/ductRules';
import type {
  CornerId,
  DuctConfig,
  SeamType,
  SheetThickness,
  SplitMode,
} from '../types/duct';
import { SHEET_THICKNESSES } from '../types/duct';

interface ParamsTabProps {
  config: DuctConfig;
  onChange: (patch: Partial<DuctConfig>) => void;
  onDimensionChange: (dim: 'W' | 'H' | 'L', value: number) => void;
  onSelectSplitMode: (mode: SplitMode) => void;
  onToggleAutoSplit: () => void;
  onSwapSeams: () => void;
  onUpdateCornerSeam: (
    cornerId: CornerId,
    patch: { seamType?: SeamType; weldOverlapWidth?: number; inverted?: boolean }
  ) => void;
  onResetCornerOverrides: () => void;
}

function SplitSchematicIcon({ mode, active }: { mode: SplitMode; active: boolean }) {
  const stroke = active ? '#38bdf8' : '#7b8da6';
  const seamDot = active ? '#ef4444' : '#94a3b8';

  return (
    <svg viewBox="0 0 36 28" className="h-6 w-8 shrink-0" aria-hidden="true">
      {mode === '1_piece' && (
        <>
          <path
            d="M 29 5 L 7 5 L 7 23 L 29 23 L 29 9"
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="29" cy="5.5" r="2.4" fill={seamDot} />
        </>
      )}
      {mode === '2_piece_L' && (
        <>
          <path
            d="M 27 4.5 L 6 4.5 L 6 20.5"
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M 9 23.5 L 30 23.5 L 30 7.5"
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="29.5" cy="5" r="2.1" fill={seamDot} />
          <circle cx="6.5" cy="23" r="2.1" fill={seamDot} />
        </>
      )}
      {mode === '2_piece_UI' && (
        <>
          <line
            x1="8.5"
            y1="4.5"
            x2="27.5"
            y2="4.5"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M 6 8 L 6 23.5 L 30 23.5 L 30 8"
            fill="none"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="6.5" cy="5" r="2.1" fill={seamDot} />
          <circle cx="29.5" cy="5" r="2.1" fill={seamDot} />
        </>
      )}
      {mode === '4_piece' && (
        <>
          <line x1="9" y1="4.5" x2="27" y2="4.5" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="9" y1="23.5" x2="27" y2="23.5" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="6" y1="8.5" x2="6" y2="19.5" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="30" y1="8.5" x2="30" y2="19.5" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="6.2" cy="5" r="1.9" fill={seamDot} />
          <circle cx="29.8" cy="5" r="1.9" fill={seamDot} />
          <circle cx="6.2" cy="23" r="1.9" fill={seamDot} />
          <circle cx="29.8" cy="23" r="1.9" fill={seamDot} />
        </>
      )}
    </svg>
  );
}

interface DimInputProps {
  id: string;
  label: string;
  code: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function DimInput({ id, label, code, value, min, max, step, onChange }: DimInputProps) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <div className="rounded-lg border border-[#232e40] bg-[#151c27] p-2">
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-medium text-slate-400">
          {label}
        </label>
        <span className="font-mono text-[10px] font-semibold text-sky-400">{code}</span>
      </div>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed)) {
            onChange(clamp(parsed));
          }
        }}
        className="no-spinner mb-1.5 w-full rounded bg-[#0d121a] px-1.5 py-1 text-center font-mono text-sm font-semibold tabular-nums text-slate-100 ring-1 ring-[#202b3c] outline-none focus:ring-sky-500/60"
      />
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="flex h-5 items-center justify-center rounded bg-[#1d2736] text-xs font-semibold text-slate-300 transition-colors hover:bg-[#273549] hover:text-white"
          aria-label={`Giảm ${label}`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="flex h-5 items-center justify-center rounded bg-[#1d2736] text-xs font-semibold text-slate-300 transition-colors hover:bg-[#273549] hover:text-white"
          aria-label={`Tăng ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ParamsTab({
  config,
  onChange,
  onDimensionChange,
  onSelectSplitMode,
  onToggleAutoSplit,
  onSwapSeams,
  onUpdateCornerSeam,
  onResetCornerOverrides,
}: ParamsTabProps) {
  const [showCornerSeamEditor, setShowCornerSeamEditor] = useState(false);

  const rec = evaluateSplitRecommendation(config.W, config.H, config.L);
  const activeSeams = resolveActiveSeams(config);
  const ribLayout = computeRibLayout(config.L, config.stiffenerRibs);
  const hasAnyOverride = activeSeams.some((s) => s.isOverridden);
  const hasOverlapSeam =
    config.globalSeamType === 'weld_overlap' ||
    activeSeams.some((s) => s.seamType === 'weld_overlap');
  const isShortDuct = config.L < 140;
  const allPittsburgh = activeSeams.every((s) => s.seamType === 'pittsburgh');

  const splitOptions: { mode: SplitMode; title: string; detail: string }[] = [
    { mode: '1_piece', title: '1 mảnh (O)', detail: '1 đường mí' },
    { mode: '2_piece_L', title: '2 mảnh L', detail: '2 mí đối góc' },
    { mode: '2_piece_UI', title: '2 mảnh U+I', detail: '2 mí mặt trên' },
    { mode: '4_piece', title: '4 mảnh rời', detail: '4 mí tại 4 góc' },
  ];

  const handleGlobalSeamChange = (seamType: SeamType) => {
    onChange({
      globalSeamType: seamType,
      seamOverrides: {},
    });
  };

  return (
    <div className="space-y-4 pb-5">
      {/* Quick Presets */}
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Cấu hình mẫu nhanh
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DUCT_PRESETS.map((preset) => {
            const isMatch =
              config.W === preset.W &&
              config.H === preset.H &&
              config.L === preset.L &&
              config.thickness === preset.thickness;
            return (
              <button
                key={preset.id}
                id={`preset-${preset.id}`}
                type="button"
                onClick={() => {
                  const nextRec = evaluateSplitRecommendation(preset.W, preset.H, preset.L);
                  onChange({
                    W: preset.W,
                    H: preset.H,
                    L: preset.L,
                    thickness: preset.thickness,
                    autoSplit: true,
                    splitMode: nextRec.recommended,
                    seamOverrides: {},
                  });
                }}
                className={`rounded-md border px-2 py-1 text-left transition-colors ${
                  isMatch
                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                    : 'border-[#232e40] bg-[#151c27] text-slate-300 hover:border-[#344662] hover:bg-[#1a2332]'
                }`}
              >
                <div className="font-mono text-[11px] font-semibold leading-tight">
                  {preset.label}
                </div>
                <div className="text-[10px] text-slate-400">{preset.subtitle}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dimensions W, H, L */}
      <section className="space-y-2.5 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Kích thước ống thẳng (mm)
          </h2>
          <span className="font-mono text-[11px] text-slate-400">
            CV: <strong className="text-slate-200">{rec.perimeter.toLocaleString('vi-VN')}</strong>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <DimInput
            id="input-W"
            label="Rộng"
            code="W"
            value={config.W}
            min={100}
            max={3000}
            step={50}
            onChange={(v) => onDimensionChange('W', v)}
          />
          <DimInput
            id="input-H"
            label="Cao"
            code="H"
            value={config.H}
            min={100}
            max={3000}
            step={50}
            onChange={(v) => onDimensionChange('H', v)}
          />
          <DimInput
            id="input-L"
            label="Dài"
            code="L"
            value={config.L}
            min={40}
            max={3000}
            step={50}
            onChange={(v) => onDimensionChange('L', v)}
          />
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#1f2939] bg-[#0d121a] px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Chu vi 2(W+H):</span>
            <span
              className={`font-mono font-medium tabular-nums ${
                rec.perimeter > 2400 ? 'text-amber-300' : 'text-slate-200'
              }`}
            >
              {rec.perimeter} mm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Nửa CV (W+H):</span>
            <span
              className={`font-mono font-medium tabular-nums ${
                rec.halfPerimeter > 3000 ? 'text-amber-300' : 'text-slate-200'
              }`}
            >
              {rec.halfPerimeter} mm
            </span>
          </div>
        </div>
      </section>

      {/* Sheet Thickness */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Độ dày tôn (t)
          </h2>
          <span className="font-mono text-xs font-semibold text-sky-300">
            {config.thickness.toFixed(2).replace(/0$/, '')} mm
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {SHEET_THICKNESSES.map((th: SheetThickness) => {
            const active = config.thickness === th;
            return (
              <button
                key={th}
                id={`btn-thick-${String(th).replace('.', '_')}`}
                type="button"
                onClick={() => onChange({ thickness: th })}
                className={`rounded-md border py-1.5 font-mono text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                    : 'border-[#232e40] bg-[#151c27] text-slate-400 hover:border-[#334560] hover:text-slate-200'
                }`}
              >
                {th}
              </button>
            );
          })}
        </div>
        {config.thickness === 1.5 && (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span>Tôn 1.5 mm vẫn chạy Mí gò Pittsburgh bình thường hoặc đổi sang Mí hàn tùy chọn.</span>
          </p>
        )}
      </section>

      {/* Piece Splitting */}
      <section className="space-y-2.5 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Chia mảnh (Khổ tôn 1200mm)
          </h2>
          <button
            id="btn-auto-split"
            type="button"
            onClick={onToggleAutoSplit}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
              config.autoSplit
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                : 'bg-[#1a2230] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>{config.autoSplit ? 'Tự động: BẬT' : 'Thủ công'}</span>
          </button>
        </div>

        {/* Recommendation rationale */}
        <div className="rounded-lg border border-[#223044] bg-[#0e1520] px-2.5 py-2 text-[11px] leading-relaxed text-slate-300">
          {rec.reason}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {splitOptions.map((opt) => {
            const active = config.splitMode === opt.mode;
            const isRec = rec.recommended === opt.mode;
            return (
              <button
                key={opt.mode}
                id={`btn-split-${opt.mode}`}
                type="button"
                onClick={() => onSelectSplitMode(opt.mode)}
                className={`flex flex-col gap-1 rounded-lg border px-2 py-2 text-left transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/15 text-slate-100'
                    : 'border-[#232e40] bg-[#151c27] text-slate-300 hover:border-[#344662] hover:bg-[#1a2332]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <SplitSchematicIcon mode={opt.mode} active={active} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-semibold leading-tight">
                      {opt.title}
                    </div>
                    <div className="truncate text-[10px] text-slate-400">{opt.detail}</div>
                  </div>
                </div>
                {isRec && (
                  <div className="flex items-center">
                    <span
                      className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9.5px] font-semibold leading-none text-sky-300"
                      title="Đề xuất tự động theo quy chuẩn nhà máy"
                    >
                      Đề xuất tự động
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          id="btn-sidebar-swap-seams"
          type="button"
          onClick={onSwapSeams}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#273549] bg-[#17202e] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-sky-500/45 hover:bg-[#1d293b] hover:text-sky-200"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 text-sky-400" />
          <span>Đảo mí kép ↔ mí đơn tự do</span>
        </button>
      </section>

      {/* Longitudinal Seams Configuration */}
      <section className="space-y-2.5 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Cấu tạo Mí ghép dọc thân
          </h2>
          {hasAnyOverride && (
            <button
              type="button"
              onClick={onResetCornerOverrides}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-400 hover:text-sky-300"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Đồng bộ lại</span>
            </button>
          )}
        </div>

        {/* Gentle hint ONLY when L < 140 mm */}
        {isShortDuct && (
          <div
            id="notice-short-length-weld"
            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200"
          >
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <div className="space-y-1.5">
                <p className="leading-snug">
                  <strong>Gợi ý nhẹ (L = {config.L} &lt; 140 mm):</strong> Ống ngắn nên cân nhắc
                  chuyển sang <strong>Mí hàn</strong> để thuận tiện gia công (vẫn có thể giữ Mí gò).
                </p>
                {allPittsburgh && (
                  <button
                    id="btn-apply-suggested-weld"
                    type="button"
                    onClick={() => handleGlobalSeamChange('weld_overlap')}
                    className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-400/40 hover:bg-amber-500/30"
                  >
                    <Flame className="h-3 w-3" />
                    <span>Áp dụng Mí hàn chồng ({config.weldOverlapWidth} mm)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Seam Mode */}
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { type: 'pittsburgh', label: 'Mí gò', sub: '+31 / +7' },
              { type: 'weld_overlap', label: 'Hàn chồng', sub: `${config.weldOverlapWidth} mm` },
              { type: 'weld_butt', label: 'Hàn đấu đầu', sub: '0 – 0' },
            ] as const
          ).map((item) => {
            const active = !hasAnyOverride && config.globalSeamType === item.type;
            return (
              <button
                key={item.type}
                id={`btn-seam-type-${item.type}`}
                type="button"
                onClick={() => handleGlobalSeamChange(item.type)}
                className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-100'
                    : 'border-[#232e40] bg-[#151c27] text-slate-300 hover:border-[#344662]'
                }`}
              >
                <div className="text-[11px] font-semibold leading-tight">{item.label}</div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-400">{item.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Overlap Width Slider (7–25 mm, default 10 mm) */}
        {hasOverlapSeam && (
          <div className="rounded-lg border border-[#232e40] bg-[#151c27] px-2.5 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <label htmlFor="slider-weld-overlap" className="font-medium text-slate-300">
                Độ rộng mí hàn chồng (7–25 mm)
              </label>
              <span className="font-mono font-semibold text-amber-300">
                {config.weldOverlapWidth} mm
              </span>
            </div>
            <input
              id="slider-weld-overlap"
              type="range"
              min={7}
              max={25}
              step={1}
              value={config.weldOverlapWidth}
              onChange={(e) => onChange({ weldOverlapWidth: Number(e.target.value) })}
              className="cad-slider w-full"
            />
          </div>
        )}

        {/* Per-Corner Seam Customization Accordion */}
        <div className="rounded-lg border border-[#212c3d] bg-[#121823]">
          <button
            id="btn-toggle-corner-seams"
            type="button"
            onClick={() => setShowCornerSeamEditor((prev) => !prev)}
            className="flex w-full items-center justify-between px-2.5 py-2 text-left text-[11px] font-medium text-slate-300 hover:text-white"
          >
            <span>Tùy chỉnh từng đường mí ({activeSeams.length} góc)</span>
            {showCornerSeamEditor ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>

          {showCornerSeamEditor && (
            <div className="space-y-2 border-t border-[#1e2838] p-2">
              {activeSeams.map((seam) => (
                <div
                  key={seam.cornerId}
                  className="rounded-md border border-[#232e40] bg-[#161e2b] p-2"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200">{seam.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCornerSeam(seam.cornerId, {
                          inverted: !config.seamOverrides[seam.cornerId]?.inverted,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded bg-[#212c3d] px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-[#2a384e]"
                      title="Đảo vai trò mí tại riêng góc này"
                    >
                      <ArrowLeftRight className="h-2.5 w-2.5" />
                      <span>Đảo góc</span>
                    </button>
                  </div>

                  <div className="mb-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                    <span>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 mr-1" />
                      {seam.seamType === 'pittsburgh' ? 'Mí kép' : 'Tấm đè'}:{' '}
                      <strong className="text-slate-200">{WALL_LABELS[seam.femaleWall]}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 mr-1" />
                      {seam.seamType === 'pittsburgh' ? 'Mí đơn' : 'Tấm nhận'}:{' '}
                      <strong className="text-slate-200">{WALL_LABELS[seam.maleWall]}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { type: 'pittsburgh', label: 'Mí gò' },
                        { type: 'weld_overlap', label: 'Hàn chồng' },
                        { type: 'weld_butt', label: 'Hàn 0–0' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() =>
                          onUpdateCornerSeam(seam.cornerId, { seamType: opt.type })
                        }
                        className={`rounded py-1 text-[10px] font-medium transition-colors ${
                          seam.seamType === opt.type
                            ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/50'
                            : 'bg-[#0e141d] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Straight Stiffener Ribs Summary */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Gân tăng cứng thân ống
          </h2>
          <button
            type="button"
            onClick={() => onChange({ stiffenerRibs: !config.stiffenerRibs })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              config.stiffenerRibs ? 'bg-sky-500' : 'bg-[#263244]'
            }`}
            aria-pressed={config.stiffenerRibs}
            aria-label="Bật tắt gân tăng cứng"
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                config.stiffenerRibs ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className="rounded-lg border border-[#1f2939] bg-[#0d121a] px-2.5 py-2 text-[11px] text-slate-300">
          {config.stiffenerRibs ? (
            ribLayout.count > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span>Gân thẳng vuông góc L</span>
                <span className="shrink-0 font-mono font-semibold text-sky-300">
                  {ribLayout.count} gân • ~{Math.round(ribLayout.pitchMm)} mm
                </span>
              </div>
            ) : (
              <span className="text-slate-400">
                Ống ngắn (L &lt; 220 mm): Tự động bỏ qua gân tăng cứng.
              </span>
            )
          ) : (
            <span className="text-slate-400">Đang tắt gân tăng cứng (bề mặt tôn phẳng trơn).</span>
          )}
        </div>
      </section>
    </div>
  );
}
