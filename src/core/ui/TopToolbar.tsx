import {
  ArrowLeftRight,
  Box,
  Columns2,
  Expand,
  Hammer,
  Layers,
  Palette,
  Scissors,
  Settings,
  Sparkles,
  Tag,
  UnfoldHorizontal,
  Wrench,
} from 'lucide-react';
import { SHEET_MATERIAL_LABELS } from '../rules/ductRules';
import type { DuctConfig, ViewportMode } from '../types/duct';
import type { ProductCapabilities } from '../types/product';

interface TopToolbarProps {
  config: DuctConfig;
  viewportMode: ViewportMode;
  onChangeViewportMode: (mode: ViewportMode) => void;
  capabilities?: ProductCapabilities;
  flatPatternSupported?: boolean;
  /** Pluggable flag: true for press-brake flat-foldable square/rectangular ducts; false for round rolled fittings */
  unfoldSupported?: boolean;
  onChange: (patch: Partial<DuctConfig>) => void;
  onSwapSeams: () => void;
  onOpenWorkshopSettings: () => void;
}

export function TopToolbar({
  config,
  viewportMode,
  onChangeViewportMode,
  capabilities,
  flatPatternSupported = true,
  unfoldSupported = true,
  onChange,
  onSwapSeams,
  onOpenWorkshopSettings,
}: TopToolbarProps) {
  const canFlatPattern = capabilities?.flatPatternSupported ?? flatPatternSupported;
  const canUnfold = capabilities?.unfoldSupported ?? unfoldSupported;
  const isRealistic = config.materialMode === 'realistic';
  const isSeamed = config.seamState === 'seamed';
  const materialLabel = SHEET_MATERIAL_LABELS[config.sheetMaterial];

  const viewModes: { id: ViewportMode; label: string; icon: typeof Box; needs2d?: boolean }[] = [
    { id: '3d', label: 'Xem 3D', icon: Box },
    { id: '2d', label: 'Trải phẳng 2D', icon: Scissors, needs2d: true },
    { id: 'split', label: 'Song song 3D + 2D', icon: Columns2, needs2d: true },
  ];

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222d3d] bg-[#11161f]/95 px-3 py-1.5 backdrop-blur-sm">
      {/* Left group: Viewport Mode Switcher + Material mode + Seam state */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 3-Mode Viewport Switcher: Xem 3D | Trải phẳng 2D | Song song 3D + 2D */}
        <div
          className="inline-flex items-center rounded-lg border border-sky-500/35 bg-[#0a1019] p-0.5"
          role="group"
          aria-label="Chế độ hiển thị Viewport"
        >
          {viewModes.map((vm) => {
            const Icon = vm.icon;
            const disabled = Boolean(vm.needs2d && !canFlatPattern);
            const active = viewportMode === vm.id;
            return (
              <button
                key={vm.id}
                id={`btn-view-${vm.id}`}
                type="button"
                disabled={disabled}
                onClick={() => onChangeViewportMode(vm.id)}
                title={
                  disabled
                    ? 'Chi tiết hiện tại không sử dụng trải phẳng 2D'
                    : vm.label
                }
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap transition-colors ${
                  disabled
                    ? 'cursor-not-allowed text-slate-600'
                    : active
                      ? 'bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/50 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{vm.label}</span>
              </button>
            );
          })}
        </div>

        {/* Material Mode Switch (syncs dynamically with Tôn Mạ Kẽm / Inox) */}
        <div
          className="inline-flex items-center rounded-lg border border-[#243043] bg-[#0c1119] p-0.5"
          role="group"
          aria-label="Chế độ vật liệu"
        >
          <button
            id="btn-mat-realistic"
            type="button"
            onClick={() => onChange({ materialMode: 'realistic' })}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
              isRealistic
                ? 'bg-[#223044] text-sky-200 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>{materialLabel}</span>
          </button>
          <button
            id="btn-mat-technical"
            type="button"
            onClick={() => onChange({ materialMode: 'technical' })}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
              !isRealistic
                ? 'bg-[#223044] text-sky-200 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="h-3.5 w-3.5 shrink-0" />
            <span>Tô màu kỹ thuật</span>
          </button>
        </div>

        {/* Seam Lock State Switch */}
        <div
          className="inline-flex items-center rounded-lg border border-[#243043] bg-[#0c1119] p-0.5"
          role="group"
          aria-label="Trạng thái mí ghép"
        >
          <button
            id="btn-seam-unseamed"
            type="button"
            onClick={() => onChange({ seamState: 'unseamed' })}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
              !isSeamed
                ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span>Chưa gò mí</span>
          </button>
          <button
            id="btn-seam-seamed"
            type="button"
            onClick={() => onChange({ seamState: 'seamed' })}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
              isSeamed
                ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hammer className="h-3.5 w-3.5 shrink-0" />
            <span>Đã gò mí</span>
          </button>
        </div>
      </div>

      {/* Right group: Explode + Mở phôi 3D + Face Labels + Ribs + Swap Seams */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Explode Slider */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[#243043] bg-[#0c1119] px-2 py-1">
          <button
            id="btn-explode-quick"
            type="button"
            title={config.explode > 0 ? 'Ghép kín ống (0%)' : 'Tách mảnh nhanh (65%)'}
            onClick={() => onChange({ explode: config.explode > 0 ? 0 : 65 })}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium whitespace-nowrap text-slate-300 transition-colors hover:text-sky-300"
          >
            <Expand className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span>Tách mảnh</span>
          </button>
          <input
            id="slider-explode"
            type="range"
            min={0}
            max={100}
            step={1}
            value={config.explode}
            onChange={(e) => onChange({ explode: Number(e.target.value) })}
            className="cad-slider w-16 xl:w-20"
            aria-label="Thanh trượt tách mảnh"
          />
          <span className="w-8 text-right font-mono text-[11.5px] font-medium tabular-nums text-sky-300">
            {config.explode}%
          </span>
        </div>

        {/* Pluggable 3D Sheet Unfold Slider (Mở phôi 3D: 0% Gập thành phẩm -> 100% Mở phẳng) */}
        {canUnfold && (
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${
              config.unfoldProgress > 0
                ? 'border-emerald-500/45 bg-emerald-500/10'
                : 'border-[#243043] bg-[#0c1119]'
            }`}
          >
            <button
              id="btn-unfold-quick"
              type="button"
              title={
                config.unfoldProgress > 0
                  ? 'Gập lại thành phẩm 3D (0%)'
                  : 'Mở phẳng phôi trực tiếp trên 3D (100%)'
              }
              onClick={() => onChange({ unfoldProgress: config.unfoldProgress > 0 ? 0 : 100 })}
              className={`inline-flex items-center gap-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                config.unfoldProgress > 0
                  ? 'text-emerald-200 hover:text-white'
                  : 'text-slate-300 hover:text-emerald-300'
              }`}
            >
              <UnfoldHorizontal className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>Mở phôi 3D</span>
            </button>
            <input
              id="slider-unfold"
              type="range"
              min={0}
              max={100}
              step={1}
              value={config.unfoldProgress}
              onChange={(e) => onChange({ unfoldProgress: Number(e.target.value) })}
              className="cad-slider w-16 xl:w-20"
              aria-label="Thanh trượt mở phôi 3D"
            />
            <span className="w-8 text-right font-mono text-[11.5px] font-medium tabular-nums text-emerald-300">
              {config.unfoldProgress}%
            </span>
          </div>
        )}

        {/* Inner Face Markings Toggle: Nhãn mặt (1-A, 1-B...) */}
        <button
          id="btn-toggle-face-labels"
          type="button"
          onClick={() => onChange({ showFaceLabels: !config.showFaceLabels })}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
            config.showFaceLabels
              ? 'border-sky-500/40 bg-sky-500/15 text-sky-200'
              : 'border-[#243043] bg-[#0c1119] text-slate-400 hover:border-[#334560] hover:text-slate-200'
          }`}
          title="Bật/tắt chữ đánh dấu mảnh/mặt trong lòng ống (1-A, 1-B, 1-C...)"
        >
          <Tag className="h-3.5 w-3.5 shrink-0" />
          <span>Nhãn mặt</span>
          <span
            className={`rounded px-1 py-0.5 font-mono text-[9.5px] leading-none ${
              config.showFaceLabels
                ? 'bg-sky-400/20 text-sky-200'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {config.showFaceLabels ? 'BẬT' : 'TẮT'}
          </span>
        </button>

        {/* Stiffener Ribs Toggle */}
        <button
          id="btn-toggle-ribs"
          type="button"
          onClick={() => onChange({ stiffenerRibs: !config.stiffenerRibs })}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
            config.stiffenerRibs
              ? 'border-sky-500/40 bg-sky-500/15 text-sky-200'
              : 'border-[#243043] bg-[#0c1119] text-slate-400 hover:border-[#334560] hover:text-slate-200'
          }`}
          title="Bật/tắt gân tăng cứng thẳng luôn chạy song song 2 đầu bích Kết nối 1 & Kết nối 2"
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span>Gân tăng cứng</span>
          <span
            className={`rounded px-1 py-0.5 font-mono text-[9.5px] leading-none ${
              config.stiffenerRibs
                ? 'bg-sky-400/20 text-sky-200'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {config.stiffenerRibs ? 'BẬT' : 'TẮT'}
          </span>
        </button>

        {/* Swap Female <-> Male Seams */}
        <button
          id="btn-swap-seams"
          type="button"
          onClick={onSwapSeams}
          className="inline-flex items-center gap-1 rounded-lg border border-[#243043] bg-[#161e2b] px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-slate-200 transition-colors hover:border-sky-500/45 hover:bg-[#1c2638] hover:text-sky-200 active:scale-[0.98]"
          title="Đảo vị trí Mí kép ↔ Mí đơn trên toàn bộ ống"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span>Đảo mí</span>
        </button>

        {/* Workshop / Machine Settings Modal Trigger */}
        <button
          id="btn-workshop-settings"
          type="button"
          onClick={onOpenWorkshopSettings}
          className="inline-flex items-center gap-1 rounded-lg border border-[#243043] bg-[#161e2b] px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-slate-200 transition-colors hover:border-sky-500/50 hover:bg-[#1c2638] hover:text-sky-200 active:scale-[0.98]"
          title="Cài đặt khổ tấm vật liệu, bước gân tăng cứng và khổ máy lăn gân"
        >
          <Settings className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span>Cài đặt xưởng</span>
        </button>
      </div>
    </header>
  );
}
