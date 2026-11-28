import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Copy,
  Flame,
  GitBranch,
  Info,
  MousePointerClick,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  C1_CAP_EDGE_IDS,
  C2_CAP_EDGE_IDS,
  FACE_SHORT_LABELS,
  resolveFoldGraph,
  type FreeMergePresetId,
} from '../../../core/foldGraph/foldGraph';
import {
  computeRibLayout,
  DUCT_PRESETS,
  evaluateSplitForConfig,
  getAllowedThicknesses,
  resolveActiveSeams,
  SHEET_MATERIAL_LABELS,
} from '../../../core/rules/ductRules';
import { END_CONNECTION_SHORT_LABELS, getEndAllowanceMm } from '../../../core/rules/endConnectionRules';
import { getActiveSheetDimensions } from '../../../core/rules/workshopSettings';
import type {
  DuctConfig,
  EdgeJoinMode,
  FoldEdgeId,
  SeamType,
  SelectionTarget,
  SheetMaterialType,
  SheetThickness,
  SplitMode,
  WorkshopSettings,
} from '../../../core/types/duct';
import { NumericDraftInput } from '../../../core/ui/NumericDraftInput';

interface ParamsTabProps {
  config: DuctConfig;
  workshopSettings: WorkshopSettings;
  selection: SelectionTarget;
  onSelectTarget: (target: SelectionTarget) => void;
  onOpenInspector: (target: NonNullable<SelectionTarget>) => void;
  onChange: (patch: Partial<DuctConfig>) => void;
  onDimensionChange: (dim: 'W' | 'H' | 'L', value: number) => void;
  onSheetMaterialChange: (material: SheetMaterialType) => void;
  onCopyC1ToC2: () => void;
  onSelectSplitMode: (mode: SplitMode) => void;
  onToggleAutoSplit: () => void;
  onToggleFreeMergeMode: () => void;
  onSetEdgeMode: (edgeId: FoldEdgeId, nextMode: EdgeJoinMode) => void;
  onApplyFreeMergePreset: (preset: FreeMergePresetId) => void;
  onSwapSeams: () => void;
}

const STEP_PRESETS = [10, 50, 100] as const;

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
      <NumericDraftInput
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        onCommit={onChange}
        className="mb-1.5 w-full rounded bg-[#0d121a] px-1.5 py-1 text-center font-mono text-sm font-semibold tabular-nums text-slate-100 ring-1 ring-[#202b3c] outline-none focus:ring-sky-500/70"
      />
      <div className="grid grid-cols-2 gap-1">
        <button
          id={`btn-dec-${code}`}
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="flex h-5 items-center justify-center rounded bg-[#1d2736] text-xs font-semibold text-slate-300 transition-colors hover:bg-[#273549] hover:text-white"
          aria-label={`Giảm ${label} ${step} mm`}
        >
          −
        </button>
        <button
          id={`btn-inc-${code}`}
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="flex h-5 items-center justify-center rounded bg-[#1d2736] text-xs font-semibold text-slate-300 transition-colors hover:bg-[#273549] hover:text-white"
          aria-label={`Tăng ${label} ${step} mm`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Slim global-controls ParamsTab:
 * - Collapsible Quick Presets accordion (DEFAULT CLOSED)
 * - Global Dimensions W, H, L + Step selector
 * - Material & Thickness (synced live with WorkshopSettings)
 * - Compact clickable C1/C2 summary cards (opens Floating Inspector on viewport)
 * - Global Split Mode, Auto-Split toggle, and `Ghép mảnh tự do` Face–Edge Graph toggle
 * - Compact default seam type + Ribs toggle (live pitch from WorkshopSettings)
 */
export function ParamsTab({
  config,
  workshopSettings,
  selection,
  onSelectTarget,
  onOpenInspector,
  onChange,
  onDimensionChange,
  onSheetMaterialChange,
  onCopyC1ToC2,
  onSelectSplitMode,
  onToggleAutoSplit,
  onToggleFreeMergeMode,
  onSetEdgeMode,
  onApplyFreeMergePreset,
  onSwapSeams,
}: ParamsTabProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [dimStep, setDimStep] = useState<number>(50);

  const activeSheet = getActiveSheetDimensions(config.sheetMaterial, workshopSettings);
  const allowedThicknesses = getAllowedThicknesses(config.sheetMaterial);
  const rec = evaluateSplitForConfig(
    config.W,
    config.H,
    config.L,
    config.sheetMaterial,
    config.c1,
    config.c2,
    workshopSettings
  );
  const activeSeams = resolveActiveSeams(config);
  const foldGraph = resolveFoldGraph(config);
  const ribLayout = computeRibLayout(config.L, config.stiffenerRibs, workshopSettings.ribPitchMm);

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

  const c1Allow = getEndAllowanceMm(config.c1);
  const c2Allow = getEndAllowanceMm(config.c2);

  const renderEdgeChip = (edgeId: FoldEdgeId) => {
    const edge = foldGraph.edges[edgeId];
    if (!edge) return null;
    const isBend = edge.mode === 'bend';
    const isSel = selection?.kind === 'edge' && selection.edgeId === edgeId;
    return (
      <button
        key={edgeId}
        id={`edge-chip-${edgeId}`}
        type="button"
        onClick={() => onSetEdgeMode(edgeId, isBend ? 'seam' : 'bend')}
        title={`${edge.label}: ${isBend ? 'Đang Liền mảnh (Chấn 90°) — Click để tách mí' : 'Đang Tách mảnh (Mí ghép) — Click để gộp liền'}`}
        className={`flex flex-col items-center justify-center rounded-md border px-1.5 py-1.5 text-center transition-colors ${
          isSel
            ? 'border-sky-400 bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/50'
            : isBend
              ? 'border-emerald-500/55 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/28'
              : 'border-[#273549] bg-[#141c29] text-slate-300 hover:border-amber-400/50 hover:text-amber-100'
        }`}
      >
        <span className="text-[10.5px] font-semibold leading-tight whitespace-nowrap">
          {edge.shortLabel}
        </span>
        <span className={`mt-0.5 text-[9px] font-medium ${isBend ? 'text-emerald-300' : 'text-amber-300/80'}`}>
          {isBend ? 'Chấn 90°' : 'Mí ghép'}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3.5 pb-5">
      {/* Collapsible Quick Presets Accordion (DEFAULT CLOSED to keep sidebar slim) */}
      <section className="rounded-lg border border-[#212c3d] bg-[#121823]">
        <button
          id="btn-toggle-presets"
          type="button"
          onClick={() => setPresetsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-2.5 py-2 text-left text-[11px] font-semibold tracking-wider text-slate-300 uppercase transition-colors hover:text-white"
        >
          <span>Cấu hình mẫu nhanh ({DUCT_PRESETS.length})</span>
          {presetsOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>

        {presetsOpen && (
          <div className="flex flex-wrap gap-1.5 border-t border-[#1e2838] p-2">
            {DUCT_PRESETS.map((preset) => {
              const isMatch =
                config.W === preset.W &&
                config.H === preset.H &&
                config.L === preset.L &&
                config.sheetMaterial === preset.sheetMaterial &&
                config.thickness === preset.thickness &&
                config.c1.type === preset.c1.type &&
                config.c2.type === preset.c2.type;
              return (
                <button
                  key={preset.id}
                  id={`preset-${preset.id}`}
                  type="button"
                  onClick={() => {
                    const nextC1 = {
                      ...preset.c1,
                      beChanEdges: { ...preset.c1.beChanEdges },
                      endCapEdgeSeams: { ...preset.c1.endCapEdgeSeams },
                    };
                    const nextC2 = {
                      ...preset.c2,
                      beChanEdges: { ...preset.c2.beChanEdges },
                      endCapEdgeSeams: { ...preset.c2.endCapEdgeSeams },
                    };
                    const nextRec = evaluateSplitForConfig(
                      preset.W,
                      preset.H,
                      preset.L,
                      preset.sheetMaterial,
                      nextC1,
                      nextC2,
                      workshopSettings
                    );
                    onSelectTarget(null);
                    onChange({
                      W: preset.W,
                      H: preset.H,
                      L: preset.L,
                      sheetMaterial: preset.sheetMaterial,
                      thickness: preset.thickness,
                      c1: nextC1,
                      c2: nextC2,
                      autoSplit: true,
                      freeMergeMode: false,
                      customEdgeStates: {},
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
        )}
      </section>

      {/* Dimensions W, H, L + Step Selector */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Kích thước (mm)
          </h2>

          {/* Step Selector: Bước: 10 | 50 | 100 + custom */}
          <div className="flex items-center gap-1" role="group" aria-label="Bước nhảy kích thước">
            <span className="text-[10px] text-slate-400">Bước:</span>
            {STEP_PRESETS.map((st) => {
              const active = dimStep === st;
              return (
                <button
                  key={st}
                  id={`btn-step-${st}`}
                  type="button"
                  onClick={() => setDimStep(st)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                    active
                      ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-500/50'
                      : 'bg-[#151c27] text-slate-400 hover:bg-[#1e2838] hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              );
            })}
            <NumericDraftInput
              id="input-custom-step"
              value={dimStep}
              min={1}
              max={500}
              step={5}
              title="Nhập bước nhảy tùy chỉnh (mm)"
              ariaLabel="Bước nhảy tùy chỉnh (mm)"
              onCommit={setDimStep}
              className="w-9 rounded border border-[#243043] bg-[#0d121a] px-1 py-0.5 text-center font-mono text-[10px] font-semibold tabular-nums text-sky-300 outline-none focus:border-sky-500/70"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <DimInput
            id="input-W"
            label="Rộng"
            code="W"
            value={config.W}
            min={100}
            max={3000}
            step={dimStep}
            onChange={(v) => onDimensionChange('W', v)}
          />
          <DimInput
            id="input-H"
            label="Cao"
            code="H"
            value={config.H}
            min={100}
            max={3000}
            step={dimStep}
            onChange={(v) => onDimensionChange('H', v)}
          />
          <DimInput
            id="input-L"
            label="Dài"
            code="L"
            value={config.L}
            min={40}
            max={3000}
            step={dimStep}
            onChange={(v) => onDimensionChange('L', v)}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg border border-[#1f2939] bg-[#0d121a] px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Chu vi:</span>
            <span className="font-mono font-medium tabular-nums text-slate-200">
              {rec.perimeter} mm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">L phôi:</span>
            <span
              className={`font-mono font-medium tabular-nums ${
                rec.exceedsSheetWidth ? 'text-red-300' : 'text-sky-300'
              }`}
            >
              {rec.blankLength} mm
            </span>
          </div>
        </div>
      </section>

      {/* Sheet Material & Thickness */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Vật liệu &amp; Độ dày
          </h2>
          <span className="font-mono text-[10.5px] font-semibold text-sky-300">
            Tấm {activeSheet.widthMm}×{activeSheet.lengthMm}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Chọn vật liệu chế tạo">
          {(
            [
              {
                id: 'galvanized',
                title: SHEET_MATERIAL_LABELS.galvanized,
                sub: `Khổ ${workshopSettings.galvanizedSheetW}×${workshopSettings.galvanizedSheetL}`,
              },
              {
                id: 'inox',
                title: SHEET_MATERIAL_LABELS.inox,
                sub: `Khổ ${workshopSettings.inoxSheetW}×${workshopSettings.inoxSheetL}`,
              },
            ] as const
          ).map((mat) => {
            const active = config.sheetMaterial === mat.id;
            return (
              <button
                key={mat.id}
                id={`btn-sheet-mat-${mat.id}`}
                type="button"
                onClick={() => onSheetMaterialChange(mat.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/15 text-slate-100'
                    : 'border-[#232e40] bg-[#151c27] text-slate-300 hover:border-[#344662] hover:bg-[#1a2332]'
                }`}
              >
                <div className="text-xs font-semibold leading-tight">{mat.title}</div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-400">{mat.sub}</div>
              </button>
            );
          })}
        </div>

        <div
          className={`grid gap-1.5 ${
            allowedThicknesses.length === 3 ? 'grid-cols-3' : 'grid-cols-6'
          }`}
        >
          {allowedThicknesses.map((th: SheetThickness) => {
            const active = config.thickness === th;
            const label = th === 1 ? '1.0' : String(th);
            return (
              <button
                key={th}
                id={`btn-thick-${String(th).replace('.', '_')}`}
                type="button"
                onClick={() => onChange({ thickness: th })}
                className={`rounded-md border py-1 font-mono text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                    : 'border-[#232e40] bg-[#151c27] text-slate-400 hover:border-[#334560] hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {config.sheetMaterial === 'galvanized' && config.thickness === 1.5 && (
          <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-slate-400">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-sky-400" />
            <span>Tôn 1.5 mm vẫn chạy Mí gò Pittsburgh bình thường hoặc đổi sang Mí hàn.</span>
          </p>
        )}
      </section>

      {/* Compact Clickable Kết nối 1 / Kết nối 2 End Connection Cards (opens Floating Inspector on viewport!) */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Kết nối 1 / Kết nối 2
          </h2>
          <button
            id="btn-copy-c1-c2"
            type="button"
            onClick={onCopyC1ToC2}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-sky-300 transition-colors hover:bg-sky-500/15"
            title="Áp dụng cấu hình Kết nối 1 cho cả Kết nối 2"
          >
            <Copy className="h-3 w-3" />
            <span>Kết nối 1 → 2</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { key: 'c1', label: 'Kết nối 1 (Trước)', conn: config.c1, allow: c1Allow },
              { key: 'c2', label: 'Kết nối 2 (Sau)', conn: config.c2, allow: c2Allow },
            ] as const
          ).map((item) => {
            const active = selection?.kind === 'end' && selection.endKey === item.key;
            return (
              <button
                key={item.key}
                id={`card-end-${item.key}`}
                type="button"
                onClick={() => onOpenInspector({ kind: 'end', endKey: item.key })}
                className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  active
                    ? 'border-amber-400/70 bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/40'
                    : 'border-[#232e40] bg-[#151c27] text-slate-200 hover:border-amber-500/50 hover:bg-[#1a2332]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold uppercase">{item.label}</span>
                  <span className="font-mono text-sky-300">+{item.allow}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-semibold text-slate-100">
                    {END_CONNECTION_SHORT_LABELS[item.conn.type]}
                  </span>
                  <Sliders className="h-3 w-3 shrink-0 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Piece Splitting + Free-Merge Face–Edge Graph Toggle */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Chia mảnh ({activeSheet.widthMm})
          </h2>
          <div className="flex items-center gap-1">
            <button
              id="btn-free-merge-mode"
              type="button"
              onClick={onToggleFreeMergeMode}
              title="Bật/tắt chế độ tự do chọn cạnh liền mảnh (Chấn 90°) hoặc tách mảnh (Mí ghép) — hỗ trợ gộp đầu bịt 5–6 mặt"
              className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                config.freeMergeMode
                  ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/60'
                  : 'bg-[#1a2230] text-slate-300 hover:bg-[#222f42] hover:text-emerald-200'
              }`}
            >
              <GitBranch className="h-3 w-3" />
              <span>Ghép tự do</span>
            </button>
            <button
              id="btn-auto-split"
              type="button"
              onClick={onToggleAutoSplit}
              className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                config.autoSplit && !config.freeMergeMode
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                  : 'bg-[#1a2230] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>{config.autoSplit && !config.freeMergeMode ? 'Tự động' : 'Thủ công'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {splitOptions.map((opt) => {
            const active = !config.freeMergeMode && config.splitMode === opt.mode;
            const isRec = rec.recommended === opt.mode;
            return (
              <button
                key={opt.mode}
                id={`btn-split-${opt.mode}`}
                type="button"
                onClick={() => onSelectSplitMode(opt.mode)}
                className={`flex flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
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
                  <span className="w-fit rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-sky-300">
                    Đề xuất
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Free-Merge Face–Edge Graph Panel (visible when Ghép tự do is active) */}
        {config.freeMergeMode && (
          <div
            id="free-merge-panel"
            className="space-y-2 rounded-lg border border-emerald-500/35 bg-[#0d161d] p-2.5 text-[10.5px]"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-semibold text-emerald-200">
                Ghép mảnh tự do ({foldGraph.components.length} mảnh)
              </span>
              <div className="flex items-center gap-1">
                <button
                  id="btn-preset-split-all"
                  type="button"
                  onClick={() => onApplyFreeMergePreset('split_all')}
                  title="Tách rời toàn bộ các mặt để tự do ghép lại từ đầu"
                  className="inline-flex items-center gap-1 rounded bg-[#182633] px-1.5 py-0.5 text-[9.5px] font-medium text-amber-200/90 hover:bg-[#233548] hover:text-amber-100"
                >
                  <span>Tách hết</span>
                </button>
                <button
                  id="btn-preset-reset-free-merge"
                  type="button"
                  onClick={() => onApplyFreeMergePreset('reset_standard')}
                  className="inline-flex items-center gap-1 rounded bg-[#182633] px-1.5 py-0.5 text-[9.5px] font-medium text-slate-300 hover:bg-[#233548] hover:text-white"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Đặt lại</span>
                </button>
              </div>
            </div>

            {/* Resolved connected components summary */}
            <div className="flex flex-wrap gap-1">
              {foldGraph.components.map((comp) => {
                const isSel = selection?.kind === 'piece' && selection.partCode === comp.partCode;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => onSelectTarget({ kind: 'piece', partCode: comp.partCode })}
                    onDoubleClick={() => onOpenInspector({ kind: 'piece', partCode: comp.partCode })}
                    className={`rounded border px-1.5 py-0.5 text-[9.5px] transition-colors ${
                      isSel
                        ? 'border-sky-400 bg-sky-500/25 text-white'
                        : 'border-[#25364a] bg-[#131e2a] text-slate-200 hover:border-sky-500/50'
                    }`}
                  >
                    <strong className="font-mono text-sky-300">{comp.partCode}</strong>:{' '}
                    {comp.faces.map((f) => FACE_SHORT_LABELS[f]).join('+')}
                  </button>
                );
              })}
            </div>

            {/* Quick 5/6-face training & creative presets when Kết nối 1 has End Cap */}
            {config.c1.type === 'end_cap' && (
              <div className="grid grid-cols-2 gap-1">
                <button
                  id="btn-preset-merge-c1-top"
                  type="button"
                  onClick={() => onApplyFreeMergePreset('merge_c1_top')}
                  className="rounded border border-emerald-500/40 bg-emerald-500/12 px-1.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/22"
                >
                  Gộp Bịt Kết nối 1 + Trên
                </button>
                <button
                  id="btn-preset-merge-c1-top-bottom"
                  type="button"
                  onClick={() => onApplyFreeMergePreset('merge_c1_top_bottom')}
                  className="rounded border border-emerald-500/40 bg-emerald-500/12 px-1.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/22"
                >
                  Bịt Kết nối 1 nối Trên+Dưới
                </button>
                <button
                  id="btn-preset-cross-5-face"
                  type="button"
                  onClick={() => onApplyFreeMergePreset('cross_5_face')}
                  className="rounded border border-sky-500/40 bg-sky-500/12 px-1.5 py-1 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/22"
                >
                  Chữ thập 5 mặt
                </button>
                {config.c2.type === 'end_cap' && (
                  <button
                    id="btn-preset-box-6-face"
                    type="button"
                    onClick={() => onApplyFreeMergePreset('box_6_face')}
                    className="rounded border border-sky-500/40 bg-sky-500/12 px-1.5 py-1 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/22"
                  >
                    Hộp kín 6 mặt
                  </button>
                )}
              </div>
            )}

            {/* Body shared edges (2×2 grid: Trên–Trái, Trên–Phải / Dưới–Trái, Dưới–Phải) */}
            <div className="space-y-1">
              <div className="text-[9.5px] font-semibold tracking-wider text-slate-400 uppercase">
                Cạnh dọc thân ống (Click đổi Chấn ↔ Mí)
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(['TL', 'TR', 'BL', 'BR'] as const).map((eid) => renderEdgeChip(eid))}
              </div>
            </div>

            {/* Kết nối 1 End-Cap shared edges */}
            {config.c1.type === 'end_cap' && (
              <div className="space-y-1">
                <div className="text-[9.5px] font-semibold tracking-wider text-amber-300/90 uppercase">
                  Cạnh tiếp giáp bịt Kết nối 1
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {C1_CAP_EDGE_IDS.map((eid) => renderEdgeChip(eid))}
                </div>
              </div>
            )}

            {/* Kết nối 2 End-Cap shared edges */}
            {config.c2.type === 'end_cap' && (
              <div className="space-y-1">
                <div className="text-[9.5px] font-semibold tracking-wider text-amber-300/90 uppercase">
                  Cạnh tiếp giáp bịt Kết nối 2
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {C2_CAP_EDGE_IDS.map((eid) => renderEdgeChip(eid))}
                </div>
              </div>
            )}

            <p className="text-[9.5px] leading-snug text-slate-400">
              Cạnh <span className="font-semibold text-emerald-300">xanh lá</span> = Chấn 90° liền
              mảnh; <span className="font-semibold text-amber-300">vàng cam</span> = Mí ghép rời. Khi
              ghép cạnh mới tạo vòng khép kín, hệ thống tự mở 1 cạnh mí phù hợp để tấm luôn trải phẳng
              và cho phép đổi cạnh mở chỉ với 1 click.
            </p>
          </div>
        )}
      </section>

      {/* Compact Global Seam Mode */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Mí ghép dọc mặc định
          </h2>
          <button
            id="btn-sidebar-swap-seams"
            type="button"
            onClick={onSwapSeams}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-500/15"
          >
            <ArrowLeftRight className="h-3 w-3" />
            <span>Đảo mí</span>
          </button>
        </div>

        {isShortDuct && (
          <div
            id="notice-short-length-weld"
            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[10.5px] text-amber-200"
          >
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <div className="space-y-1">
                <p className="leading-snug">
                  L = {config.L} &lt; 140 mm: Cân nhắc chuyển sang <strong>Mí hàn</strong>.
                </p>
                {allPittsburgh && (
                  <button
                    id="btn-apply-suggested-weld"
                    type="button"
                    onClick={() => handleGlobalSeamChange('weld_overlap')}
                    className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10.5px] font-semibold text-amber-100 ring-1 ring-amber-400/40"
                  >
                    <Flame className="h-3 w-3" />
                    <span>Áp dụng Hàn chập ({config.weldOverlapWidth} mm)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { type: 'pittsburgh', label: 'Mí gò', sub: '+31 / +7' },
              { type: 'weld_overlap', label: 'Hàn chập', sub: `${config.weldOverlapWidth} mm` },
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
                className={`rounded-lg border px-1.5 py-1.5 text-center transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-100'
                    : 'border-[#232e40] bg-[#151c27] text-slate-300 hover:border-[#344662]'
                }`}
              >
                <div className="text-[11px] font-semibold leading-tight">{item.label}</div>
                <div className="mt-0.5 font-mono text-[9.5px] text-slate-400">{item.sub}</div>
              </button>
            );
          })}
        </div>

        {hasOverlapSeam && (
          <div className="rounded-lg border border-[#232e40] bg-[#151c27] px-2.5 py-1.5">
            <div className="mb-1 flex items-center justify-between text-[10.5px]">
              <label htmlFor="slider-weld-overlap" className="font-medium text-slate-300">
                Bản mí hàn chập (7–25 mm)
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
      </section>

      {/* Straight Stiffener Ribs Summary */}
      <section className="space-y-1.5 border-t border-[#1e2838] pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Gân tăng cứng
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
        <div className="rounded-lg border border-[#1f2939] bg-[#0d121a] px-2.5 py-1.5 text-[11px] text-slate-300">
          {config.stiffenerRibs ? (
            ribLayout.count > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <span>Song song bích Kết nối 1 / 2</span>
                <span className="shrink-0 font-mono font-semibold text-sky-300">
                  {ribLayout.count} gân • bước {ribLayout.pitchMm} mm
                </span>
              </div>
            ) : (
              <span className="text-slate-400">Ống ngắn (L &lt; 220 mm): Tự bỏ qua gân.</span>
            )
          ) : (
            <span className="text-slate-400">Đang tắt gân tăng cứng.</span>
          )}
        </div>
      </section>

      {/* Subtle Direct-Interaction Hint */}
      <div className="flex items-start gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/6 px-2.5 py-2 text-[10.5px] leading-snug text-slate-400">
        <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span>
          <strong className="text-slate-200">Click:</strong> Chọn nổi bật •{' '}
          <strong className="text-slate-200">Click đúp:</strong> Mở thẻ chỉnh nhanh •{' '}
          <strong className="text-slate-200">Chuột phải:</strong> Menu nhanh trên 3D &amp; 2D.
        </span>
      </div>
    </div>
  );
}
