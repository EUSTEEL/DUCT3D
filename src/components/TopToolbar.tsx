import {
  ArrowLeftRight,
  Expand,
  Hammer,
  Layers,
  Palette,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { SHEET_MATERIAL_LABELS } from '../domain/ductRules';
import type { DuctConfig } from '../types/duct';

interface TopToolbarProps {
  config: DuctConfig;
  onChange: (patch: Partial<DuctConfig>) => void;
  onSwapSeams: () => void;
}

export function TopToolbar({ config, onChange, onSwapSeams }: TopToolbarProps) {
  const isRealistic = config.materialMode === 'realistic';
  const isSeamed = config.seamState === 'seamed';
  const materialLabel = SHEET_MATERIAL_LABELS[config.sheetMaterial];

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222d3d] bg-[#11161f]/95 px-3 py-1.5 backdrop-blur-sm">
      {/* Left group: Material mode + Seam state */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Right group: Explode slider + Ribs toggle + Swap Seams */}
      <div className="flex flex-wrap items-center gap-2">
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
            className="cad-slider w-20 xl:w-24"
            aria-label="Thanh trượt tách mảnh"
          />
          <span className="w-8 text-right font-mono text-[11.5px] font-medium tabular-nums text-sky-300">
            {config.explode}%
          </span>
        </div>

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
          title="Bật/tắt gân tăng cứng thẳng song song vuông góc trục ống"
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
      </div>
    </header>
  );
}
