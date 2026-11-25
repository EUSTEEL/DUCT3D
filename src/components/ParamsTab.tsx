import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Flame,
  Info,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  calculateBlankAnalysis,
  computeRibLayout,
  DUCT_PRESETS,
  evaluateSplitForConfig,
  getAllowedThicknesses,
  getSheetStandardWidth,
  resolveActiveSeams,
  SHEET_MATERIAL_LABELS,
  WALL_LABELS,
} from '../domain/ductRules';
import { BE_CHAN_MODE_LABELS, getEndCapEdgeSeam } from '../domain/endConnectionRules';
import type {
  BeChanEdgeMode,
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  SeamType,
  SheetMaterialType,
  SheetThickness,
  SplitMode,
  WallId,
} from '../types/duct';
import { EndConnectionPanel } from './EndConnectionPanel';
import { NumericDraftInput } from './NumericDraftInput';

interface ParamsTabProps {
  config: DuctConfig;
  selectedPartCode: string | null;
  onSelectPart: (partCode: string | null) => void;
  onChange: (patch: Partial<DuctConfig>) => void;
  onDimensionChange: (dim: 'W' | 'H' | 'L', value: number) => void;
  onSheetMaterialChange: (material: SheetMaterialType) => void;
  onUpdateEndConnection: (end: 'c1' | 'c2', patch: Partial<EndConnectionConfig>) => void;
  onCopyC1ToC2: () => void;
  onSelectSplitMode: (mode: SplitMode) => void;
  onToggleAutoSplit: () => void;
  onSwapSeams: () => void;
  onUpdateCornerSeam: (
    cornerId: CornerId,
    patch: { seamType?: SeamType; weldOverlapWidth?: number; inverted?: boolean }
  ) => void;
  onResetCornerOverrides: () => void;
}

const STEP_PRESETS = [10, 50, 100] as const;
const WALL_ORDER: WallId[] = ['top', 'bottom', 'left', 'right'];

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

export function ParamsTab({
  config,
  selectedPartCode,
  onSelectPart,
  onChange,
  onDimensionChange,
  onSheetMaterialChange,
  onUpdateEndConnection,
  onCopyC1ToC2,
  onSelectSplitMode,
  onToggleAutoSplit,
  onSwapSeams,
  onUpdateCornerSeam,
  onResetCornerOverrides,
}: ParamsTabProps) {
  const [showCornerSeamEditor, setShowCornerSeamEditor] = useState(false);
  const [dimStep, setDimStep] = useState<number>(50);

  const sheetWidth = getSheetStandardWidth(config.sheetMaterial);
  const allowedThicknesses = getAllowedThicknesses(config.sheetMaterial);
  const rec = evaluateSplitForConfig(
    config.W,
    config.H,
    config.L,
    config.sheetMaterial,
    config.c1,
    config.c2
  );
  const activeSeams = resolveActiveSeams(config);
  const ribLayout = computeRibLayout(config.L, config.stiffenerRibs);
  const blankPieces = calculateBlankAnalysis(config);
  const selectedPiece = blankPieces.find((p) => p.partCode === selectedPartCode) ?? null;

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

  // Seams belonging to the currently selected body piece
  const selectedPieceSeams =
    selectedPiece && !selectedPiece.isEndCap
      ? activeSeams.filter(
          (s) =>
            selectedPiece.walls.includes(s.femaleWall) ||
            selectedPiece.walls.includes(s.maleWall)
        )
      : [];

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
                    nextC2
                  );
                  onSelectPart(null);
                  onChange({
                    W: preset.W,
                    H: preset.H,
                    L: preset.L,
                    sheetMaterial: preset.sheetMaterial,
                    thickness: preset.thickness,
                    c1: nextC1,
                    c2: nextC2,
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

      {/* Interactive Piece / Face Selector (1-A, 1-B, 1-C, 1-D, 1-E, 1-F...) */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between gap-1.5">
          <h2 className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <MousePointerClick className="h-3.5 w-3.5 text-sky-400" />
            <span>Chọn mảnh / mặt (1-A, 1-B...)</span>
          </h2>
          {selectedPiece && (
            <button
              type="button"
              onClick={() => onSelectPart(null)}
              className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-sky-300"
            >
              <X className="h-3 w-3" />
              <span>Bỏ chọn</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {blankPieces.map((p) => {
            const active = selectedPartCode === p.partCode;
            return (
              <button
                key={p.id}
                id={`btn-part-${p.partCode}`}
                type="button"
                onClick={() => onSelectPart(active ? null : p.partCode)}
                className={`rounded-md border px-2 py-1 text-left transition-colors ${
                  active
                    ? 'border-sky-400 bg-sky-500/22 text-white ring-1 ring-sky-400/50'
                    : 'border-[#232e40] bg-[#141b26] text-slate-300 hover:border-[#354866]'
                }`}
              >
                <div className="font-mono text-[11px] font-bold leading-tight text-sky-300">
                  {p.partCode}
                </div>
                <div className="max-w-[100px] truncate text-[9.5px] text-slate-400">
                  {p.isEndCap
                    ? `Bịt ${p.endKey?.toUpperCase()}`
                    : p.walls.length === 4
                      ? '4 mặt (Chữ O)'
                      : p.wallsLabel}
                </div>
              </button>
            );
          })}
        </div>

        {/* Contextual Inspector for Selected Piece/Face */}
        {selectedPiece && (
          <div
            id="selected-part-inspector"
            className="space-y-2 rounded-lg border border-sky-500/45 bg-[#111b2a] p-2.5 text-[11px]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sky-100">
                <span className="mr-1.5 rounded bg-sky-500/25 px-1.5 py-0.5 font-mono text-[10.5px] text-sky-200">
                  {selectedPiece.partCode}
                </span>
                {selectedPiece.name}
              </div>
              <span className="font-mono text-[10px] text-sky-300">
                {selectedPiece.developedWidth}×{selectedPiece.blankLength}
              </span>
            </div>

            {selectedPiece.isEndCap && selectedPiece.endKey ? (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">
                  Tùy chỉnh đường mí ghép mảnh bịt {selectedPiece.partCode}
                </div>
                {WALL_ORDER.map((wall) => {
                  const endK = selectedPiece.endKey!;
                  const endConn = config[endK];
                  const cur = getEndCapEdgeSeam(endConn, wall);
                  return (
                    <div
                      key={wall}
                      className="flex items-center justify-between gap-1.5 rounded bg-[#0c131f] px-2 py-1"
                    >
                      <span className="w-10 text-[10.5px] font-semibold text-slate-300">
                        {WALL_LABELS[wall]}
                      </span>
                      <div className="grid flex-1 grid-cols-3 gap-1">
                        {(
                          [
                            { tp: 'pittsburgh', lb: 'Mí gò' },
                            { tp: 'weld_overlap', lb: 'Hàn chập' },
                            { tp: 'weld_butt', lb: 'Hàn đấu đầu' },
                          ] as { tp: SeamType; lb: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.tp}
                            type="button"
                            onClick={() =>
                              onUpdateEndConnection(endK, {
                                endCapEdgeSeams: {
                                  ...endConn.endCapEdgeSeams,
                                  [wall]: opt.tp,
                                },
                              })
                            }
                            className={`rounded py-0.5 text-[9.5px] font-medium ${
                              cur === opt.tp
                                ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                : 'bg-[#151e2d] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {opt.lb}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {selectedPieceSeams.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">
                      Đường mí dọc của mảnh {selectedPiece.partCode}
                    </div>
                    {selectedPieceSeams.map((seam) => (
                      <div key={seam.cornerId} className="rounded bg-[#0c131f] p-1.5">
                        <div className="mb-1 flex items-center justify-between text-[10.5px]">
                          <span className="font-semibold text-slate-200">{seam.label}</span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCornerSeam(seam.cornerId, {
                                inverted: !config.seamOverrides[seam.cornerId]?.inverted,
                              })
                            }
                            className="rounded bg-[#1b2738] px-1.5 py-0.5 text-[9.5px] text-sky-300 hover:bg-[#24344c]"
                          >
                            ⇄ Đảo góc
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { tp: 'pittsburgh', lb: 'Mí gò' },
                              { tp: 'weld_overlap', lb: 'Hàn chập' },
                              { tp: 'weld_butt', lb: 'Hàn đấu đầu' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.tp}
                              type="button"
                              onClick={() =>
                                onUpdateCornerSeam(seam.cornerId, { seamType: opt.tp })
                              }
                              className={`rounded py-0.5 text-[9.5px] font-medium ${
                                seam.seamType === opt.tp
                                  ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                  : 'bg-[#151e2d] text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {opt.lb}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick per-wall Bẻ chân editor if C1 or C2 is be_chan */}
                {(['c1', 'c2'] as const).map((endK) => {
                  const endConn = config[endK];
                  if (endConn.type !== 'be_chan') return null;
                  return (
                    <div key={endK} className="space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">
                        Cạnh Bẻ chân ({endK.toUpperCase()}) trên {selectedPiece.partCode}
                      </div>
                      {selectedPiece.walls.map((w) => {
                        const cur = endConn.beChanEdges[w];
                        return (
                          <div
                            key={w}
                            className="flex items-center justify-between gap-1.5 rounded bg-[#0c131f] px-2 py-1"
                          >
                            <span className="w-10 text-[10.5px] font-semibold text-slate-300">
                              {WALL_LABELS[w]}
                            </span>
                            <div className="grid flex-1 grid-cols-3 gap-1">
                              {(['in', 'out', 'straight'] as BeChanEdgeMode[]).map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() =>
                                    onUpdateEndConnection(endK, {
                                      beChanEdges: { ...endConn.beChanEdges, [w]: m },
                                    })
                                  }
                                  className={`rounded py-0.5 text-[9.5px] font-medium ${
                                    cur === m
                                      ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                      : 'bg-[#151e2d] text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {BE_CHAN_MODE_LABELS[m]}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Dimensions W, H, L + Step Selector */}
      <section className="space-y-2.5 border-t border-[#1e2838] pt-3.5">
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

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg border border-[#1f2939] bg-[#0d121a] px-2.5 py-1.5 text-[11px]">
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
            <span className="text-slate-400">L phôi thân:</span>
            <span
              className={`font-mono font-medium tabular-nums ${
                rec.blankLength > sheetWidth ? 'text-amber-300' : 'text-sky-300'
              }`}
            >
              {rec.blankLength} mm
            </span>
          </div>
        </div>
      </section>

      {/* Sheet Material Selector: Tôn Mạ Kẽm (1200mm) vs Inox (1250mm — KHÔNG mô tả thừa) */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Vật liệu chế tạo
          </h2>
          <span className="font-mono text-[11px] font-semibold text-sky-300">
            Khổ {sheetWidth} mm
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Chọn vật liệu chế tạo">
          {(
            [
              {
                id: 'galvanized',
                title: SHEET_MATERIAL_LABELS.galvanized,
                sub: 'Hoa nhỏ • Khổ 1200 mm',
              },
              {
                id: 'inox',
                title: SHEET_MATERIAL_LABELS.inox,
                sub: 'Khổ 1250 mm',
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
                className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/15 text-slate-100'
                    : 'border-[#232e40] bg-[#151c27] text-slate-300 hover:border-[#344662] hover:bg-[#1a2332]'
                }`}
              >
                <div className="text-xs font-semibold leading-tight">{mat.title}</div>
                <div className="mt-0.5 text-[10px] text-slate-400">{mat.sub}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sheet Thickness */}
      <section className="space-y-2 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Độ dày {config.sheetMaterial === 'inox' ? 'Inox' : 'tôn'} (t)
          </h2>
          <span className="font-mono text-xs font-semibold text-sky-300">
            {config.thickness.toFixed(2).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '.0' : ''))} mm
          </span>
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
                className={`rounded-md border py-1.5 font-mono text-[11px] font-medium transition-colors ${
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
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span>Tôn 1.5 mm vẫn chạy Mí gò Pittsburgh bình thường hoặc đổi sang Mí hàn tùy chọn.</span>
          </p>
        )}
      </section>

      {/* Stage 2: End Connections Library */}
      <EndConnectionPanel
        c1={config.c1}
        c2={config.c2}
        onUpdateEnd={onUpdateEndConnection}
        onCopyC1ToC2={onCopyC1ToC2}
      />

      {/* Piece Splitting */}
      <section className="space-y-2.5 border-t border-[#1e2838] pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Chia mảnh (Khổ {sheetWidth}mm)
          </h2>
          <button
            id="btn-auto-split"
            type="button"
            onClick={onToggleAutoSplit}
            className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
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

      {/* Longitudinal Seams Configuration (Hàn chập & Hàn đấu đầu) */}
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
                    <span>Áp dụng Hàn chập ({config.weldOverlapWidth} mm)</span>
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
                Độ rộng mí hàn chập (7–25 mm)
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
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                      {seam.seamType === 'pittsburgh' ? 'Mí kép' : 'Tấm đè'}:{' '}
                      <strong className="text-slate-200">{WALL_LABELS[seam.femaleWall]}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {seam.seamType === 'pittsburgh' ? 'Mí đơn' : 'Tấm nhận'}:{' '}
                      <strong className="text-slate-200">{WALL_LABELS[seam.maleWall]}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { type: 'pittsburgh', label: 'Mí gò' },
                        { type: 'weld_overlap', label: 'Hàn chập' },
                        { type: 'weld_butt', label: 'Hàn đấu đầu' },
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
                  {ribLayout.count} gân • bước {ribLayout.pitchMm} mm
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
