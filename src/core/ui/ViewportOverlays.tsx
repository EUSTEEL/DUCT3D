import { Box, Crosshair, Eye, PanelLeftOpen, RotateCcw, Sliders, Square, X } from 'lucide-react';
import {
  CORNER_SHORT_LABELS,
  END_LABELS,
  SHEET_MATERIAL_LABELS,
  SPLIT_MODE_LABELS,
} from '../rules/ductRules';
import { END_CONNECTION_SHORT_LABELS } from '../rules/endConnectionRules';
import { FOLD_EDGE_DEFS } from '../foldGraph/foldGraph';
import type { CameraPreset, DuctConfig, SelectionTarget } from '../types/duct';

interface ViewportOverlaysProps {
  config: DuctConfig;
  sidebarOpen: boolean;
  selection: SelectionTarget;
  inspectorOpen: boolean;
  onClearSelection: () => void;
  onOpenInspector: (target: NonNullable<SelectionTarget>) => void;
  onExpandSidebar: () => void;
  onCameraPreset: (preset: CameraPreset) => void;
  compact?: boolean;
}

export function ViewportOverlays({
  config,
  sidebarOpen,
  selection,
  inspectorOpen,
  onClearSelection,
  onOpenInspector,
  onExpandSidebar,
  onCameraPreset,
  compact = false,
}: ViewportOverlaysProps) {
  const isTech = config.materialMode === 'technical';
  const matLabel = SHEET_MATERIAL_LABELS[config.sheetMaterial];
  const c1Label = END_CONNECTION_SHORT_LABELS[config.c1.type];
  const c2Label = END_CONNECTION_SHORT_LABELS[config.c2.type];
  const endsSummary =
    c1Label === c2Label
      ? `2× ${c1Label}`
      : `Kết nối 1: ${c1Label} • Kết nối 2: ${c2Label}`;

  const pillText = selection
    ? selection.kind === 'piece'
      ? { prefix: 'Đang chọn mảnh:', code: selection.partCode }
      : selection.kind === 'end'
        ? { prefix: 'Đang chọn:', code: END_LABELS[selection.endKey] }
        : selection.kind === 'seam'
          ? { prefix: 'Đang chọn mí:', code: CORNER_SHORT_LABELS[selection.cornerId] }
          : { prefix: 'Đang chọn cạnh:', code: FOLD_EDGE_DEFS[selection.edgeId].shortLabel }
    : null;

  return (
    <>
      {/* Top-Left Floating Expand Button & Selected Target Pill */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        {!sidebarOpen && (
          <button
            id="btn-expand-sidebar"
            type="button"
            onClick={onExpandSidebar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a3950] bg-[#0e141e]/90 px-3 py-1.5 text-xs font-medium text-sky-200 shadow-lg backdrop-blur-md transition-colors hover:border-sky-500/60 hover:bg-[#162030] hover:text-white"
            title="Mở lại bảng điều khiển bên trái"
          >
            <PanelLeftOpen className="h-4 w-4 text-sky-400" />
            <span>Bảng điều khiển</span>
          </button>
        )}

        {selection && pillText && (
          <div
            id="pill-selected-part"
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/55 bg-sky-500/18 px-2.5 py-1 text-xs font-medium text-sky-100 shadow-lg backdrop-blur-md"
          >
            <span>{pillText.prefix}</span>
            <strong className="font-mono font-bold text-white">{pillText.code}</strong>
            {!inspectorOpen && (
              <button
                id="btn-pill-open-inspector"
                type="button"
                onClick={() => onOpenInspector(selection)}
                title="Mở thẻ tùy chỉnh nhanh (hoặc Click đúp lên đối tượng)"
                className="ml-0.5 inline-flex items-center gap-1 rounded bg-sky-400/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-100 transition-colors hover:bg-sky-400/35 hover:text-white"
              >
                <Sliders className="h-3 w-3" />
                <span>Chỉnh</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Bỏ chọn"
              className="rounded p-0.5 text-sky-200 hover:bg-sky-400/25 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom-Left: Compact Status Pill / Technical Color Legend */}
      <div className={`pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 ${compact ? 'max-w-[58%]' : ''}`}>
        {isTech && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-[#253247] bg-[#0e141e]/90 px-2.5 py-1 text-[10.5px] text-slate-200 backdrop-blur-md">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#e13f3f]" />
              <span>Mí kép (+31)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#2f7cf6]" />
              <span>Mí đơn (+7)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#eab308]" />
              <span>Bích</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#22c55e]" />
              <span>Chấn 90°</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#f59e0b]" />
              <span>Mí hàn</span>
            </span>
          </div>
        )}

        <div className="inline-flex w-fit flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-[#222e40] bg-[#0e141e]/80 px-2.5 py-1 font-mono text-[10.5px] text-slate-300 backdrop-blur-md">
          <span className="font-semibold text-sky-300">
            {config.W} × {config.H} × L{config.L} mm
          </span>
          <span className="text-slate-600">|</span>
          <span className="font-sans text-slate-200">
            {matLabel} <span className="font-mono">{config.thickness}</span> mm
          </span>
          {!compact && (
            <>
              <span className="text-slate-600">|</span>
              <span className="font-sans text-amber-200/90">{endsSummary}</span>
              <span className="text-slate-600">|</span>
              <span className={`font-sans ${config.freeMergeMode ? 'font-semibold text-emerald-300' : 'text-slate-300'}`}>
                {config.freeMergeMode ? 'Ghép mảnh tự do' : SPLIT_MODE_LABELS[config.splitMode]}
              </span>
              <span className="text-slate-600">|</span>
              <span
                className={`font-sans font-medium ${
                  config.seamState === 'seamed' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {config.seamState === 'seamed' ? 'Đã gò mí' : 'Chưa gò mí'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bottom-Right: Clean Camera View Presets */}
      <div
        className="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-lg border border-[#243145] bg-[#0e141e]/85 p-1 backdrop-blur-md"
        role="group"
        aria-label="Góc nhìn 3D"
      >
        <button
          id="cam-iso"
          type="button"
          onClick={() => onCameraPreset('iso')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-[#1e2a3c] hover:text-sky-200"
          title="Góc nhìn phối cảnh 3/4"
        >
          <Box className="h-3.5 w-3.5" />
          {!compact && <span className="hidden sm:inline">Phối cảnh</span>}
        </button>
        <button
          id="cam-seam-closeup"
          type="button"
          onClick={() => onCameraPreset('seam_closeup')}
          className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2 py-1 text-[11px] font-medium text-sky-200 transition-colors hover:bg-sky-500/25"
          title="Phóng cận cảnh mặt cắt góc mí ghép"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>{compact ? 'Soi mí' : 'Soi góc mí'}</span>
        </button>
        <button
          id="cam-front"
          type="button"
          onClick={() => onCameraPreset('front_section')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-[#1e2a3c] hover:text-sky-200"
          title="Nhìn trực diện tiết diện lòng ống"
        >
          <Square className="h-3.5 w-3.5" />
          {!compact && <span className="hidden sm:inline">Mặt cắt</span>}
        </button>
        <button
          id="cam-top"
          type="button"
          onClick={() => onCameraPreset('top')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-[#1e2a3c] hover:text-sky-200"
          title="Nhìn từ trên xuống"
        >
          <Eye className="h-3.5 w-3.5" />
          {!compact && <span className="hidden sm:inline">Mặt bằng</span>}
        </button>
        <button
          id="cam-reset"
          type="button"
          onClick={() => onCameraPreset('reset')}
          className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-[#1e2a3c] hover:text-slate-100"
          title="Đặt lại góc nhìn mặc định"
          aria-label="Đặt lại góc nhìn"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}
