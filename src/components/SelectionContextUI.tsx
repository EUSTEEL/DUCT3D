import { useEffect } from 'react';
import {
  ArrowLeftRight,
  CircleDot,
  Copy,
  Crosshair,
  Layers,
  Lock,
  RotateCcw,
  Sliders,
  X,
} from 'lucide-react';
import {
  calculateBlankAnalysis,
  resolveActiveSeams,
  WALL_LABELS,
} from '../domain/ductRules';
import {
  BE_CHAN_MODE_LABELS,
  BE_CHAN_PRESETS,
  BICH_U_OUTER_LIP_MM,
  END_CONNECTION_SHORT_LABELS,
  getEndAllowanceMm,
  getEndCapEdgeSeam,
  getEndNotchSummary,
} from '../domain/endConnectionRules';
import type {
  BeChanEdgeMode,
  BichUThickness,
  BichVSpec,
  BichVThickness,
  ContextMenuState,
  CornerId,
  DuctConfig,
  EndConnectionConfig,
  EndConnectionType,
  SeamType,
  SelectionTarget,
  WallId,
  WorkshopSettings,
} from '../types/duct';
import {
  BICH_U_THICKNESSES,
  BICH_V_IN_SPECS,
  BICH_V_SPECS,
  BICH_V_THICKNESSES,
} from '../types/duct';
import { NumericDraftInput } from './NumericDraftInput';

const INTEGRAL_END_OPTIONS: { type: EndConnectionType; label: string; badge: string }[] = [
  { type: 'tdc_tdf', label: 'TDC/TDF', badge: '+48' },
  { type: 'nep_c', label: 'Nẹp C', badge: '+12.5' },
  { type: 'be_chan', label: 'Bẻ chân', badge: '+F' },
  { type: 'lcct', label: 'Lưới LCCT', badge: '+20' },
  { type: 'end_cap', label: 'Đầu bịt kín', badge: 'Mí/Hàn' },
  { type: 'plain', label: 'Để thẳng', badge: '+L' },
];

const DETACHED_END_OPTIONS: { type: EndConnectionType; label: string; badge: string }[] = [
  { type: 'bich_v_out', label: 'Bích V ngoài', badge: 'V30–80' },
  { type: 'bich_v_in', label: 'Bích V trong', badge: 'W−3' },
  { type: 'bich_u', label: 'Bích U rời', badge: 'Lệch' },
];

const ALL_END_OPTIONS = [...INTEGRAL_END_OPTIONS, ...DETACHED_END_OPTIONS];
const PLAIN_EXT_PRESETS = [0, 20, 30, 40, 50] as const;
const WALL_ORDER: WallId[] = ['top', 'bottom', 'left', 'right'];

export interface SelectionContextUIProps {
  config: DuctConfig;
  workshopSettings: WorkshopSettings;
  selection: SelectionTarget;
  contextMenu: ContextMenuState | null;
  onCloseContextMenu: () => void;
  onSelectTarget: (target: SelectionTarget) => void;
  onFocusPiece: (partCode: string) => void;
  onUpdateEndConnection: (end: 'c1' | 'c2', patch: Partial<EndConnectionConfig>) => void;
  onApplyEndToBoth: (sourceEnd: 'c1' | 'c2') => void;
  onUpdateCornerSeam: (
    cornerId: CornerId,
    patch: { seamType?: SeamType; weldOverlapWidth?: number; inverted?: boolean }
  ) => void;
  onResetCornerOverrides: () => void;
  onPatchConfig: (patch: Partial<DuctConfig>) => void;
}

export function SelectionContextUI({
  config,
  workshopSettings,
  selection,
  contextMenu,
  onCloseContextMenu,
  onSelectTarget,
  onFocusPiece,
  onUpdateEndConnection,
  onApplyEndToBoth,
  onUpdateCornerSeam,
  onResetCornerOverrides,
  onPatchConfig,
}: SelectionContextUIProps) {
  // Close ContextMenu & Floating Inspector cleanly on Esc key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (contextMenu) {
        onCloseContextMenu();
      } else if (selection) {
        onSelectTarget(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contextMenu, selection, onCloseContextMenu, onSelectTarget]);

  // Dismiss ContextMenu on any outside pointerdown
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.('#cad-context-menu')) return;
      onCloseContextMenu();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [contextMenu, onCloseContextMenu]);

  const activeSeams = resolveActiveSeams(config);
  const blankPieces = calculateBlankAnalysis(config, workshopSettings);

  const selectEndType = (endKey: 'c1' | 'c2', type: EndConnectionType) => {
    const cur = config[endKey];
    if (type === 'bich_v_in' && cur.bichVSpec === 'V80x30') {
      onUpdateEndConnection(endKey, { type, bichVSpec: 'V40x40' });
    } else {
      onUpdateEndConnection(endKey, { type });
    }
  };

  // Clamp context menu coordinates inside current browser viewport
  const menuW = 286;
  const menuH = 380;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const menuX = contextMenu ? Math.max(8, Math.min(contextMenu.x, winW - menuW - 8)) : 0;
  const menuY = contextMenu ? Math.max(8, Math.min(contextMenu.y, winH - menuH - 8)) : 0;

  return (
    <>
      {/* 1. Right-Click Context Menu */}
      {contextMenu && (
        <div
          id="cad-context-menu"
          role="menu"
          style={{ left: menuX, top: menuY, width: menuW }}
          className="fixed z-50 overflow-hidden rounded-xl border border-[#2d405c] bg-[#0f1724]/98 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.target.kind === 'piece' && (() => {
            const code = contextMenu.target.partCode;
            const piece = blankPieces.find((p) => p.partCode === code);
            const pieceSeams =
              piece && !piece.isEndCap
                ? activeSeams.filter(
                    (s) =>
                      piece.walls.includes(s.femaleWall) || piece.walls.includes(s.maleWall)
                  )
                : [];
            return (
              <div className="divide-y divide-[#1e2b3e]">
                <div className="flex items-center justify-between bg-[#141f30] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-sky-500/25 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-200">
                      {code}
                    </span>
                    <span className="max-w-[140px] truncate font-semibold text-slate-100">
                      {piece?.name ?? `Mảnh ${code}`}
                    </span>
                  </div>
                  {piece && (
                    <span className="font-mono text-[10px] text-sky-300">
                      {piece.developedWidth}×{piece.blankLength}
                    </span>
                  )}
                </div>

                <div className="space-y-1 p-1.5">
                  <button
                    id="ctx-focus-piece"
                    type="button"
                    onClick={() => {
                      onSelectTarget({ kind: 'piece', partCode: code });
                      onFocusPiece(code);
                      onCloseContextMenu();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-medium text-sky-200 transition-colors hover:bg-sky-500/18 hover:text-white"
                  >
                    <Crosshair className="h-3.5 w-3.5 text-sky-400" />
                    <span>Phóng to mảnh này</span>
                  </button>
                  <button
                    id="ctx-open-piece-inspector"
                    type="button"
                    onClick={() => {
                      onSelectTarget({ kind: 'piece', partCode: code });
                      onCloseContextMenu();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-medium text-slate-200 transition-colors hover:bg-[#1c283b] hover:text-white"
                  >
                    <Sliders className="h-3.5 w-3.5 text-slate-400" />
                    <span>Tùy chỉnh chi tiết mảnh {code}</span>
                  </button>
                </div>

                {pieceSeams.length > 0 && (
                  <div className="space-y-1.5 p-2">
                    <div className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Mí ghép dọc của mảnh {code}
                    </div>
                    {pieceSeams.map((seam) => (
                      <div key={seam.cornerId} className="rounded-lg bg-[#0b111b] p-1.5">
                        <div className="mb-1 flex items-center justify-between text-[10.5px]">
                          <span className="font-semibold text-slate-200">{seam.label}</span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateCornerSeam(seam.cornerId, {
                                inverted: !config.seamOverrides[seam.cornerId]?.inverted,
                              })
                            }
                            className="rounded bg-[#1a2638] px-1.5 py-0.5 text-[9.5px] font-medium text-sky-300 hover:bg-[#24344d]"
                          >
                            ⇄ Đảo mí
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { tp: 'pittsburgh', lb: 'Mí gò' },
                              { tp: 'weld_overlap', lb: 'Hàn chập' },
                              { tp: 'weld_butt', lb: 'Đấu đầu' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.tp}
                              type="button"
                              onClick={() =>
                                onUpdateCornerSeam(seam.cornerId, { seamType: opt.tp })
                              }
                              className={`rounded py-1 text-[10px] font-medium transition-colors ${
                                seam.seamType === opt.tp
                                  ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                  : 'bg-[#141e2e] text-slate-400 hover:text-slate-100'
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

                <div className="grid grid-cols-2 gap-1 p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTarget({ kind: 'end', endKey: 'c1' });
                      onCloseContextMenu();
                    }}
                    className="rounded-md border border-[#233248] bg-[#131d2c] px-2 py-1 text-left text-[10.5px] text-slate-200 hover:border-amber-400/50 hover:text-amber-200"
                  >
                    <div className="text-[9.5px] text-slate-400">Đầu C1</div>
                    <div className="truncate font-semibold">
                      {END_CONNECTION_SHORT_LABELS[config.c1.type]}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTarget({ kind: 'end', endKey: 'c2' });
                      onCloseContextMenu();
                    }}
                    className="rounded-md border border-[#233248] bg-[#131d2c] px-2 py-1 text-left text-[10.5px] text-slate-200 hover:border-amber-400/50 hover:text-amber-200"
                  >
                    <div className="text-[9.5px] text-slate-400">Đầu C2</div>
                    <div className="truncate font-semibold">
                      {END_CONNECTION_SHORT_LABELS[config.c2.type]}
                    </div>
                  </button>
                </div>

                {/* Disabled Coming-Soon Extension Placeholders */}
                <div className="space-y-0.5 bg-[#0b111b]/80 p-1.5">
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[10.5px] text-slate-500"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <CircleDot className="h-3.5 w-3.5 opacity-60" />
                      <span>+ Trổ lỗ / Chân rẽ mặt này</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded bg-slate-800/80 px-1 py-0.5 text-[9px] text-slate-500">
                      <Lock className="h-2.5 w-2.5" />
                      Chặng sau
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[10.5px] text-slate-500"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 opacity-60" />
                      <span>+ Lớp bọc mặt này</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded bg-slate-800/80 px-1 py-0.5 text-[9px] text-slate-500">
                      <Lock className="h-2.5 w-2.5" />
                      Chặng sau
                    </span>
                  </button>
                </div>
              </div>
            );
          })()}

          {contextMenu.target.kind === 'end' && (() => {
            const endKey = contextMenu.target.endKey;
            const conn = config[endKey];
            const endTitle = endKey === 'c1' ? 'Đầu C1 (Trước)' : 'Đầu C2 (Sau)';
            return (
              <div className="divide-y divide-[#1e2b3e]">
                <div className="flex items-center justify-between bg-[#141f30] px-3 py-2">
                  <span className="font-semibold text-amber-200">{endTitle}</span>
                  <span className="font-mono text-[10.5px] text-sky-300">
                    {END_CONNECTION_SHORT_LABELS[conn.type]} (+{getEndAllowanceMm(conn)})
                  </span>
                </div>
                <div className="p-2">
                  <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Đổi nhanh kiểu kết nối
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {ALL_END_OPTIONS.map((opt) => {
                      const active = conn.type === opt.type;
                      return (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => {
                            selectEndType(endKey, opt.type);
                            onSelectTarget({ kind: 'end', endKey });
                            onCloseContextMenu();
                          }}
                          className={`rounded-md border px-1.5 py-1.5 text-center transition-colors ${
                            active
                              ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                              : 'border-[#233248] bg-[#131d2c] text-slate-300 hover:border-sky-500/50 hover:text-white'
                          }`}
                        >
                          <div className="truncate text-[10px] font-semibold">{opt.label}</div>
                          <div className="font-mono text-[9px] text-slate-400">{opt.badge}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1 p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyEndToBoth(endKey);
                      onCloseContextMenu();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Áp dụng giống nhau cho cả C1 &amp; C2</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTarget({ kind: 'end', endKey });
                      onCloseContextMenu();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-sky-200 hover:bg-sky-500/15"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    <span>Mở thông số chi tiết {endKey.toUpperCase()}...</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {contextMenu.target.kind === 'seam' && (() => {
            const cornerId = contextMenu.target.cornerId;
            const seam = activeSeams.find((s) => s.cornerId === cornerId);
            if (!seam) return null;
            return (
              <div className="divide-y divide-[#1e2b3e]">
                <div className="flex items-center justify-between bg-[#141f30] px-3 py-2">
                  <span className="font-semibold text-emerald-200">{seam.label}</span>
                  <span className="font-mono text-[10px] text-slate-400">{cornerId}</span>
                </div>
                <div className="space-y-2 p-2.5">
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { tp: 'pittsburgh', lb: 'Mí gò' },
                        { tp: 'weld_overlap', lb: 'Hàn chập' },
                        { tp: 'weld_butt', lb: 'Đấu đầu' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.tp}
                        type="button"
                        onClick={() => onUpdateCornerSeam(cornerId, { seamType: opt.tp })}
                        className={`rounded-md py-1.5 text-[10.5px] font-semibold transition-colors ${
                          seam.seamType === opt.tp
                            ? 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/60'
                            : 'bg-[#152030] text-slate-300 hover:bg-[#1e2d44]'
                        }`}
                      >
                        {opt.lb}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCornerSeam(cornerId, {
                        inverted: !config.seamOverrides[cornerId]?.inverted,
                      })
                    }
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2a3b55] bg-[#162234] px-2.5 py-1.5 text-[11px] font-medium text-sky-200 hover:border-sky-400/50"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-sky-400" />
                    <span>Đảo mí kép ↔ mí đơn tại góc này</span>
                  </button>
                  {seam.seamType === 'weld_overlap' && (
                    <div className="rounded-lg bg-[#0b111b] p-2">
                      <div className="mb-1 flex justify-between text-[10.5px]">
                        <span className="text-slate-300">Độ rộng hàn chập</span>
                        <span className="font-mono font-semibold text-amber-300">
                          {seam.weldOverlapWidth} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={7}
                        max={25}
                        step={1}
                        value={seam.weldOverlapWidth}
                        onChange={(e) =>
                          onUpdateCornerSeam(cornerId, {
                            weldOverlapWidth: Number(e.target.value),
                          })
                        }
                        className="cad-slider w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 2. Compact Floating Inspector Card (appears cleanly in viewport top-right on left-click) */}
      {selection && (
        <div
          id="floating-inspector"
          className="fixed top-14 right-3 z-40 flex max-h-[calc(100vh-5.5rem)] w-[312px] flex-col overflow-hidden rounded-xl border border-[#2d405c] bg-[#0f1622]/96 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#202d40] bg-[#141e2e] px-3 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {selection.kind === 'piece' && (
                <>
                  <span className="rounded bg-sky-500/25 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-200">
                    {selection.partCode}
                  </span>
                  <span className="truncate font-semibold text-slate-100">
                    {blankPieces.find((p) => p.partCode === selection.partCode)?.name ??
                      `Mảnh ${selection.partCode}`}
                  </span>
                </>
              )}
              {selection.kind === 'end' && (
                <>
                  <span className="rounded bg-amber-500/25 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-200">
                    {selection.endKey.toUpperCase()}
                  </span>
                  <span className="truncate font-semibold text-slate-100">
                    Đầu kết nối {selection.endKey === 'c1' ? '(Trước)' : '(Sau)'}
                  </span>
                </>
              )}
              {selection.kind === 'seam' && (
                <>
                  <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-200">
                    {selection.cornerId}
                  </span>
                  <span className="truncate font-semibold text-slate-100">
                    {activeSeams.find((s) => s.cornerId === selection.cornerId)?.label ??
                      `Mí góc ${selection.cornerId}`}
                  </span>
                </>
              )}
            </div>
            <button
              id="btn-close-inspector"
              type="button"
              onClick={() => onSelectTarget(null)}
              aria-label="Đóng bảng tùy chỉnh nhanh"
              title="Đóng (Esc)"
              className="rounded p-1 text-slate-400 transition-colors hover:bg-[#223047] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="cad-scroll space-y-3 overflow-y-auto p-3 text-[11px]">
            {/* PIECE INSPECTOR */}
            {selection.kind === 'piece' && (() => {
              const piece = blankPieces.find((p) => p.partCode === selection.partCode);
              if (!piece) {
                return (
                  <p className="text-slate-400">
                    Mảnh này không còn tồn tại trong kiểu chia hiện tại.
                  </p>
                );
              }
              const pieceSeams = !piece.isEndCap
                ? activeSeams.filter(
                    (s) =>
                      piece.walls.includes(s.femaleWall) || piece.walls.includes(s.maleWall)
                  )
                : [];

              return (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-[#223045] bg-[#0b111b] px-2.5 py-2">
                    <div>
                      <div className="font-mono text-xs font-bold text-sky-300">
                        {piece.developedWidth} × {piece.blankLength} mm
                      </div>
                      <div className="text-[10px] text-slate-400">
                        S phôi: {piece.areaM2.toFixed(2)} m² • {piece.bendCount} đường chấn
                      </div>
                    </div>
                    <button
                      id="btn-inspector-focus-piece"
                      type="button"
                      onClick={() => onFocusPiece(piece.partCode)}
                      className="inline-flex items-center gap-1 rounded-md border border-sky-500/45 bg-sky-500/15 px-2 py-1 text-[10.5px] font-semibold text-sky-200 hover:bg-sky-500/25 hover:text-white"
                    >
                      <Crosshair className="h-3 w-3" />
                      <span>Phóng to</span>
                    </button>
                  </div>

                  <div
                    className={`rounded-md px-2 py-1 text-[10.5px] font-medium ${
                      piece.cutOrientation === 'can_noi_c'
                        ? 'bg-red-500/15 text-red-200'
                        : 'bg-emerald-500/15 text-emerald-200'
                    }`}
                  >
                    {piece.cutNote}
                  </div>

                  {piece.isEndCap && piece.endKey ? (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                        Cạnh ghép mảnh bịt đầu ({piece.endKey.toUpperCase()})
                      </div>
                      {WALL_ORDER.map((wall) => {
                        const endK = piece.endKey!;
                        const endConn = config[endK];
                        const cur = getEndCapEdgeSeam(endConn, wall);
                        return (
                          <div
                            key={wall}
                            className="flex items-center justify-between gap-1.5 rounded bg-[#0b111b] px-2 py-1"
                          >
                            <span className="w-10 font-semibold text-slate-300">
                              {WALL_LABELS[wall]}
                            </span>
                            <div className="grid flex-1 grid-cols-3 gap-1">
                              {(
                                [
                                  { tp: 'pittsburgh', lb: 'Mí gò' },
                                  { tp: 'weld_overlap', lb: 'Hàn chập' },
                                  { tp: 'weld_butt', lb: 'Đấu đầu' },
                                ] as const
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
                                  className={`rounded py-0.5 text-[10px] font-medium ${
                                    cur === opt.tp
                                      ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                      : 'bg-[#151e2d] text-slate-400 hover:text-slate-100'
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
                    <>
                      {pieceSeams.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                            Mí dọc tiếp giáp mảnh {piece.partCode}
                          </div>
                          {pieceSeams.map((seam) => (
                            <div
                              key={seam.cornerId}
                              className="space-y-1.5 rounded-lg border border-[#202d40] bg-[#0b111b] p-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-200">{seam.label}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateCornerSeam(seam.cornerId, {
                                      inverted: !config.seamOverrides[seam.cornerId]?.inverted,
                                    })
                                  }
                                  className="rounded bg-[#1a2638] px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-[#24344d]"
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
                                    className={`rounded py-1 text-[10px] font-medium ${
                                      seam.seamType === opt.tp
                                        ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                        : 'bg-[#151e2d] text-slate-400 hover:text-slate-100'
                                    }`}
                                  >
                                    {opt.lb}
                                  </button>
                                ))}
                              </div>
                              {seam.seamType === 'weld_overlap' && (
                                <div className="pt-1">
                                  <div className="mb-0.5 flex justify-between text-[10px]">
                                    <span className="text-slate-400">Bản mí hàn chập</span>
                                    <span className="font-mono text-amber-300">
                                      {seam.weldOverlapWidth} mm
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={7}
                                    max={25}
                                    step={1}
                                    value={seam.weldOverlapWidth}
                                    onChange={(e) =>
                                      onUpdateCornerSeam(seam.cornerId, {
                                        weldOverlapWidth: Number(e.target.value),
                                      })
                                    }
                                    className="cad-slider w-full"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick Bẻ chân editor for this piece's walls when C1 or C2 is be_chan */}
                      {(['c1', 'c2'] as const).map((endK) => {
                        const endConn = config[endK];
                        if (endConn.type !== 'be_chan') return null;
                        return (
                          <div key={endK} className="space-y-1">
                            <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                              Cạnh Bẻ chân ({endK.toUpperCase()}) trên {piece.partCode}
                            </div>
                            {piece.walls.map((w) => {
                              const cur = endConn.beChanEdges[w];
                              return (
                                <div
                                  key={w}
                                  className="flex items-center justify-between gap-1.5 rounded bg-[#0b111b] px-2 py-1"
                                >
                                  <span className="w-10 font-semibold text-slate-300">
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
                                        className={`rounded py-0.5 text-[10px] font-medium ${
                                          cur === m
                                            ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                            : 'bg-[#151e2d] text-slate-400 hover:text-slate-100'
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
                    </>
                  )}

                  {/* Disabled Future Extensions */}
                  <div className="space-y-1 border-t border-[#1e2b3e] pt-2">
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between rounded-lg border border-[#1d2737] bg-[#0b111b]/60 px-2.5 py-1.5 text-[10.5px] text-slate-500"
                    >
                      <span>+ Trổ lỗ / Chân rẽ mặt này</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px]">
                        Chặng sau
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between rounded-lg border border-[#1d2737] bg-[#0b111b]/60 px-2.5 py-1.5 text-[10.5px] text-slate-500"
                    >
                      <span>+ Lớp bọc mặt này</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px]">
                        Chặng sau
                      </span>
                    </button>
                  </div>
                </>
              );
            })()}

            {/* END CONNECTION INSPECTOR (C1 / C2) */}
            {selection.kind === 'end' && (() => {
              const endKey = selection.endKey;
              const conn = config[endKey];
              const handlePatch = (p: Partial<EndConnectionConfig>) =>
                onUpdateEndConnection(endKey, p);
              const hasEndCapOverlap =
                conn.type === 'end_cap' &&
                WALL_ORDER.some((w) => getEndCapEdgeSeam(conn, w) === 'weld_overlap');

              return (
                <>
                  {/* Quick C1 <-> C2 switcher */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['c1', 'c2'] as const).map((ek) => (
                      <button
                        key={ek}
                        id={`inspector-tab-end-${ek}`}
                        type="button"
                        onClick={() => onSelectTarget({ kind: 'end', endKey: ek })}
                        className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                          endKey === ek
                            ? 'border-amber-400/65 bg-amber-500/18 text-amber-100'
                            : 'border-[#233248] bg-[#131d2c] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex justify-between text-[9.5px] font-semibold uppercase">
                          <span>{ek === 'c1' ? 'Đầu C1 (Trước)' : 'Đầu C2 (Sau)'}</span>
                          <span className="font-mono text-sky-300">
                            +{getEndAllowanceMm(config[ek])}
                          </span>
                        </div>
                        <div className="truncate text-[11px] font-semibold text-slate-100">
                          {END_CONNECTION_SHORT_LABELS[config[ek].type]}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Copy to both ends */}
                  <button
                    id="btn-inspector-apply-both-ends"
                    type="button"
                    onClick={() => onApplyEndToBoth(endKey)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Áp dụng giống nhau cho cả C1 &amp; C2</span>
                  </button>

                  {/* Integral & Detached connection grid */}
                  <div className="space-y-1.5">
                    <div className="text-[9.5px] font-semibold tracking-wider text-slate-400 uppercase">
                      Bích liền thân ống
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {INTEGRAL_END_OPTIONS.map((opt) => (
                        <button
                          key={opt.type}
                          id={`btn-conn-${endKey}-${opt.type}`}
                          type="button"
                          onClick={() => selectEndType(endKey, opt.type)}
                          className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-left transition-colors ${
                            conn.type === opt.type
                              ? 'border-sky-500/70 bg-sky-500/20 text-sky-100'
                              : 'border-[#222f43] bg-[#131c2b] text-slate-300 hover:border-[#354967]'
                          }`}
                        >
                          <span className="truncate font-semibold">{opt.label}</span>
                          <span className="font-mono text-[9.5px] text-slate-400">{opt.badge}</span>
                        </button>
                      ))}
                    </div>
                    <div className="pt-1 text-[9.5px] font-semibold tracking-wider text-slate-400 uppercase">
                      Bích rời (Không lỗ)
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {DETACHED_END_OPTIONS.map((opt) => (
                        <button
                          key={opt.type}
                          id={`btn-conn-${endKey}-${opt.type}`}
                          type="button"
                          onClick={() => selectEndType(endKey, opt.type)}
                          className={`rounded-md border px-1 py-1.5 text-center transition-colors ${
                            conn.type === opt.type
                              ? 'border-sky-500/70 bg-sky-500/20 text-sky-100'
                              : 'border-[#222f43] bg-[#131c2b] text-slate-300 hover:border-[#354967]'
                          }`}
                        >
                          <div className="truncate text-[10px] font-semibold">{opt.label}</div>
                          <div className="font-mono text-[9px] text-slate-400">{opt.badge}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contextual sub-parameters */}
                  {conn.type === 'tdc_tdf' && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#223045] bg-[#0b111b] px-2.5 py-2">
                      <div>
                        <div className="font-semibold text-slate-200">
                          Vết khấu V cạnh tai (TDF)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tắt = TDC phẳng trơn • Bật = Vết V lõm cạnh tai +48
                        </div>
                      </div>
                      <button
                        id={`toggle-tdc-indent-${endKey}`}
                        type="button"
                        onClick={() => handlePatch({ showEndIndent: !conn.showEndIndent })}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          conn.showEndIndent ? 'bg-sky-500' : 'bg-[#263244]'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            conn.showEndIndent ? 'translate-x-4.5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {conn.type === 'bich_v_out' && (
                    <div className="space-y-2 rounded-lg border border-[#223045] bg-[#0b111b] p-2.5">
                      <div className="grid grid-cols-4 gap-1">
                        {BICH_V_SPECS.map((spec: BichVSpec) => (
                          <button
                            key={spec}
                            type="button"
                            onClick={() => handlePatch({ bichVSpec: spec })}
                            className={`rounded border py-1 font-mono text-[10px] font-semibold ${
                              conn.bichVSpec === spec
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                                : 'border-[#243043] bg-[#121a28] text-slate-400'
                            }`}
                          >
                            {spec.replace('x', '×')}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {BICH_V_THICKNESSES.map((th: BichVThickness) => (
                          <button
                            key={th}
                            type="button"
                            onClick={() => handlePatch({ bichVThickness: th })}
                            className={`rounded border py-1 font-mono text-[10.5px] font-semibold ${
                              conn.bichVThickness === th
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                                : 'border-[#243043] bg-[#121a28] text-slate-400'
                            }`}
                          >
                            Dày {th} mm
                          </button>
                        ))}
                      </div>
                      {conn.bichVSpec !== 'V80x30' && (
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => handlePatch({ bichVOutStyle: 'standard' })}
                            className={`rounded border px-2 py-1 text-left ${
                              conn.bichVOutStyle === 'standard'
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                                : 'border-[#243043] bg-[#121a28] text-slate-300'
                            }`}
                          >
                            <div className="font-semibold">Ống thường</div>
                            <div className="font-mono text-[9.5px] text-slate-400">W+5 • +8 mm</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePatch({ bichVOutStyle: 'ei' })}
                            className={`rounded border px-2 py-1 text-left ${
                              conn.bichVOutStyle === 'ei'
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                                : 'border-[#243043] bg-[#121a28] text-slate-300'
                            }`}
                          >
                            <div className="font-semibold">Ống EI</div>
                            <div className="font-mono text-[9.5px] text-slate-400">W−3 • +0 mm</div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {conn.type === 'bich_v_in' && (
                    <div className="space-y-2 rounded-lg border border-[#223045] bg-[#0b111b] p-2.5">
                      <div className="grid grid-cols-3 gap-1">
                        {BICH_V_IN_SPECS.map((spec: BichVSpec) => (
                          <button
                            key={spec}
                            type="button"
                            onClick={() => handlePatch({ bichVSpec: spec })}
                            className={`rounded border py-1 font-mono text-[10px] font-semibold ${
                              conn.bichVSpec === spec
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                                : 'border-[#243043] bg-[#121a28] text-slate-400'
                            }`}
                          >
                            {spec.replace('x', '×')}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {BICH_V_THICKNESSES.map((th: BichVThickness) => (
                          <button
                            key={th}
                            type="button"
                            onClick={() => handlePatch({ bichVThickness: th })}
                            className={`rounded border py-1 font-mono text-[10.5px] font-semibold ${
                              conn.bichVThickness === th
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                                : 'border-[#243043] bg-[#121a28] text-slate-400'
                            }`}
                          >
                            Dày {th} mm
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {conn.type === 'bich_u' && (
                    <div className="space-y-2 rounded-lg border border-[#223045] bg-[#0b111b] p-2.5">
                      <div className="grid grid-cols-3 gap-1">
                        {BICH_U_THICKNESSES.map((th: BichUThickness) => (
                          <button
                            key={th}
                            type="button"
                            onClick={() => handlePatch({ bichUThickness: th })}
                            className={`rounded border py-1 font-mono text-[10.5px] font-semibold ${
                              conn.bichUThickness === th
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                                : 'border-[#243043] bg-[#121a28] text-slate-400'
                            }`}
                          >
                            Dày {th} mm
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor={`inspector-bichu-wrap-${endKey}`}
                            className="mb-1 block text-[10px] text-slate-400"
                          >
                            Cánh ôm (mm)
                          </label>
                          <NumericDraftInput
                            id={`inspector-bichu-wrap-${endKey}`}
                            value={conn.bichUWrapLeg}
                            min={15}
                            max={80}
                            step={5}
                            onCommit={(v) => handlePatch({ bichUWrapLeg: v })}
                            className="w-full rounded bg-[#141d2c] px-2 py-1 text-center font-mono text-xs font-semibold text-slate-100 ring-1 ring-[#26354d]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`inspector-bichu-face-${endKey}`}
                            className="mb-1 block text-[10px] text-slate-400"
                          >
                            Mặt bích (mm)
                          </label>
                          <NumericDraftInput
                            id={`inspector-bichu-face-${endKey}`}
                            value={conn.bichUFlangeFace}
                            min={20}
                            max={100}
                            step={5}
                            onCommit={(v) => handlePatch({ bichUFlangeFace: v })}
                            className="w-full rounded bg-[#141d2c] px-2 py-1 text-center font-mono text-xs font-semibold text-slate-100 ring-1 ring-[#26354d]"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Gờ bẻ ngoài cố định: <strong className="text-sky-300">{BICH_U_OUTER_LIP_MM} mm</strong> quay về thân
                      </div>
                    </div>
                  )}

                  {conn.type === 'plain' && (
                    <div className="space-y-2 rounded-lg border border-[#223045] bg-[#0b111b] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <label
                            htmlFor={`inspector-plain-ext-${endKey}`}
                            className="block font-semibold text-slate-200"
                          >
                            Chiều dài đoạn để thẳng (mm)
                          </label>
                          <div className="text-[10px] text-slate-400">Đoạn trơn không chạy mí</div>
                        </div>
                        <NumericDraftInput
                          id={`inspector-plain-ext-${endKey}`}
                          value={conn.plainExtensionMm}
                          min={0}
                          max={300}
                          step={10}
                          onCommit={(v) => handlePatch({ plainExtensionMm: v })}
                          className="w-16 rounded bg-[#141d2c] px-1.5 py-1 text-center font-mono text-xs font-semibold text-sky-200 ring-1 ring-[#26354d]"
                        />
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {PLAIN_EXT_PRESETS.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => handlePatch({ plainExtensionMm: v })}
                            className={`rounded border py-1 font-mono text-[10px] font-semibold ${
                              conn.plainExtensionMm === v
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                                : 'border-[#243043] bg-[#121a28] text-slate-400'
                            }`}
                          >
                            {v === 0 ? '0' : `+${v}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {conn.type === 'be_chan' && (
                    <div className="space-y-2 rounded-lg border border-[#223045] bg-[#0b111b] p-2.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`inspector-bechan-f-${endKey}`}
                          className="font-semibold text-slate-200"
                        >
                          Bẻ chân F (mm)
                        </label>
                        <NumericDraftInput
                          id={`inspector-bechan-f-${endKey}`}
                          value={conn.beChanWidth}
                          min={5}
                          max={100}
                          step={5}
                          onCommit={(v) => handlePatch({ beChanWidth: v })}
                          className="w-16 rounded bg-[#141d2c] px-1.5 py-1 text-center font-mono text-xs font-semibold text-sky-200 ring-1 ring-[#26354d]"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {BE_CHAN_PRESETS.map((pr) => (
                          <button
                            key={pr.id}
                            type="button"
                            onClick={() => handlePatch({ beChanEdges: { ...pr.edges } })}
                            className="rounded border border-[#243043] bg-[#131c2b] px-2 py-0.5 text-[10px] text-slate-300 hover:border-sky-500/50 hover:text-sky-200"
                          >
                            {pr.label}
                          </button>
                        ))}
                      </div>
                      {WALL_ORDER.map((wall) => (
                        <div
                          key={wall}
                          className="flex items-center justify-between gap-1.5 rounded bg-[#111927] px-2 py-1"
                        >
                          <span className="w-10 font-semibold text-slate-300">
                            {WALL_LABELS[wall]}
                          </span>
                          <div className="grid flex-1 grid-cols-3 gap-1">
                            {(['in', 'out', 'straight'] as BeChanEdgeMode[]).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  handlePatch({
                                    beChanEdges: { ...conn.beChanEdges, [wall]: m },
                                  })
                                }
                                className={`rounded py-0.5 text-[10px] font-medium ${
                                  conn.beChanEdges[wall] === m
                                    ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/60'
                                    : 'bg-[#172133] text-slate-400'
                                }`}
                              >
                                {BE_CHAN_MODE_LABELS[m]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {conn.type === 'lcct' && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#223045] bg-[#0b111b] px-2.5 py-2">
                      <span className="font-semibold text-slate-200">Hiển thị khung lưới LCCT</span>
                      <button
                        type="button"
                        onClick={() => handlePatch({ showLcctMesh: !conn.showLcctMesh })}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          conn.showLcctMesh ? 'bg-sky-500' : 'bg-[#263244]'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            conn.showLcctMesh ? 'translate-x-4.5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {conn.type === 'end_cap' && (
                    <div className="space-y-2 rounded-lg border border-[#223045] bg-[#0b111b] p-2.5">
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            { tp: 'pittsburgh', lb: 'Mí gò' },
                            { tp: 'weld_overlap', lb: 'Hàn chập' },
                            { tp: 'weld_butt', lb: 'Đấu đầu' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.tp}
                            type="button"
                            onClick={() =>
                              handlePatch({ endCapSeamType: opt.tp, endCapEdgeSeams: {} })
                            }
                            className={`rounded border py-1 text-[10px] font-semibold ${
                              WALL_ORDER.every((w) => getEndCapEdgeSeam(conn, w) === opt.tp)
                                ? 'border-sky-500/60 bg-sky-500/20 text-sky-100'
                                : 'border-[#243043] bg-[#121a28] text-slate-300'
                            }`}
                          >
                            {opt.lb}
                          </button>
                        ))}
                      </div>
                      {hasEndCapOverlap && (
                        <div>
                          <div className="mb-0.5 flex justify-between text-[10px]">
                            <span className="text-slate-400">Độ rộng hàn chập</span>
                            <span className="font-mono text-amber-300">
                              {conn.endCapWeldOverlapWidth} mm
                            </span>
                          </div>
                          <input
                            type="range"
                            min={7}
                            max={25}
                            step={1}
                            value={conn.endCapWeldOverlapWidth}
                            onChange={(e) =>
                              handlePatch({ endCapWeldOverlapWidth: Number(e.target.value) })
                            }
                            className="cad-slider w-full"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border border-sky-500/25 bg-sky-500/8 px-2.5 py-1.5 text-[10.5px] leading-snug text-sky-200">
                    {getEndNotchSummary(conn)}
                  </div>
                </>
              );
            })()}

            {/* SEAM INSPECTOR */}
            {selection.kind === 'seam' && (() => {
              const seam = activeSeams.find((s) => s.cornerId === selection.cornerId);
              if (!seam) {
                return (
                  <p className="text-slate-400">
                    Góc này không phải đường mí ghép trong kiểu chia hiện tại.
                  </p>
                );
              }
              return (
                <>
                  <div className="rounded-lg border border-[#223045] bg-[#0b111b] p-2.5 text-[10.5px] text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
                        {seam.seamType === 'pittsburgh' ? 'Mí kép (+31)' : 'Tấm đè'}:{' '}
                        <strong className="text-white">{WALL_LABELS[seam.femaleWall]}</strong>
                      </span>
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
                        {seam.seamType === 'pittsburgh' ? 'Mí đơn (+7)' : 'Tấm nhận'}:{' '}
                        <strong className="text-white">{WALL_LABELS[seam.maleWall]}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { tp: 'pittsburgh', lb: 'Mí gò', sub: '+31 / +7' },
                        { tp: 'weld_overlap', lb: 'Hàn chập', sub: `${seam.weldOverlapWidth} mm` },
                        { tp: 'weld_butt', lb: 'Đấu đầu', sub: '0 – 0' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.tp}
                        type="button"
                        onClick={() => onUpdateCornerSeam(seam.cornerId, { seamType: opt.tp })}
                        className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                          seam.seamType === opt.tp
                            ? 'border-emerald-400/65 bg-emerald-500/20 text-emerald-100'
                            : 'border-[#233248] bg-[#131d2c] text-slate-300 hover:border-sky-500/50'
                        }`}
                      >
                        <div className="font-semibold">{opt.lb}</div>
                        <div className="font-mono text-[9.5px] text-slate-400">{opt.sub}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCornerSeam(seam.cornerId, {
                        inverted: !config.seamOverrides[seam.cornerId]?.inverted,
                      })
                    }
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2a3b55] bg-[#162234] px-2.5 py-1.5 font-medium text-sky-200 hover:border-sky-400/50"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-sky-400" />
                    <span>Đảo mí kép ↔ mí đơn tại góc {seam.cornerId}</span>
                  </button>

                  {seam.seamType === 'weld_overlap' && (
                    <div className="rounded-lg border border-[#223045] bg-[#0b111b] p-2.5">
                      <div className="mb-1 flex justify-between">
                        <span className="text-slate-300">Độ rộng hàn chập (7–25 mm)</span>
                        <span className="font-mono font-semibold text-amber-300">
                          {seam.weldOverlapWidth} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={7}
                        max={25}
                        step={1}
                        value={seam.weldOverlapWidth}
                        onChange={(e) =>
                          onUpdateCornerSeam(seam.cornerId, {
                            weldOverlapWidth: Number(e.target.value),
                          })
                        }
                        className="cad-slider w-full"
                      />
                    </div>
                  )}

                  <div className="flex gap-1.5 border-t border-[#1e2b3e] pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        onPatchConfig({
                          globalSeamType: seam.seamType,
                          weldOverlapWidth: seam.weldOverlapWidth,
                          seamOverrides: {},
                        })
                      }
                      className="flex-1 rounded-md border border-[#283850] bg-[#152031] px-2 py-1 text-[10.5px] font-medium text-slate-200 hover:border-sky-500/50 hover:text-sky-200"
                    >
                      Áp dụng cho mọi góc
                    </button>
                    {seam.isOverridden && (
                      <button
                        type="button"
                        onClick={onResetCornerOverrides}
                        className="inline-flex items-center gap-1 rounded-md border border-[#283850] bg-[#152031] px-2 py-1 text-[10.5px] text-amber-300 hover:border-amber-400/50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Đặt lại</span>
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
