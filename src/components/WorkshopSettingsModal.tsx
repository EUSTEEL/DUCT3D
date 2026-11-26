import { useEffect } from 'react';
import { RotateCcw, Settings, X } from 'lucide-react';
import { DEFAULT_WORKSHOP_SETTINGS } from '../domain/workshopSettings';
import type { WorkshopSettings } from '../types/duct';
import { NumericDraftInput } from './NumericDraftInput';

interface WorkshopSettingsModalProps {
  open: boolean;
  settings: WorkshopSettings;
  onChange: (next: WorkshopSettings) => void;
  onReset: () => void;
  onClose: () => void;
}

export function WorkshopSettingsModal({
  open,
  settings,
  onChange,
  onReset,
  onClose,
}: WorkshopSettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = (partial: Partial<WorkshopSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div
      id="modal-workshop-settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt xưởng và máy móc"
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#2a3950] bg-[#111824] text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#202d40] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/35">
              <Settings className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Cài đặt xưởng / Máy móc</h2>
              <p className="text-[11px] text-slate-400">
                Tự động lưu trên trình duyệt • Cập nhật ngay trên 3D &amp; 2D
              </p>
            </div>
          </div>
          <button
            id="btn-close-workshop-x"
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt xưởng"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-[#1c2738] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4 text-xs">
          {/* 1. Roll-former & Rib pitch */}
          <div className="space-y-2.5 rounded-lg border border-[#223045] bg-[#0c121c] p-3">
            <div className="text-[10.5px] font-semibold tracking-wider text-sky-300 uppercase">
              Máy lăn gân tăng cứng
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="ws-roll-former"
                  className="block font-semibold text-slate-200"
                >
                  Khổ máy lăn gân tối đa (mm)
                </label>
                <span className="text-[10.5px] text-slate-400">
                  Kiểm tra theo chiều vuông góc với đường gân (L phôi)
                </span>
              </div>
              <NumericDraftInput
                id="ws-roll-former"
                value={settings.rollFormerLimitMm}
                min={600}
                max={4000}
                step={50}
                ariaLabel="Khổ máy lăn gân tối đa (mm)"
                onCommit={(v) => patch({ rollFormerLimitMm: v })}
                className="w-24 rounded-md border border-[#2b3b54] bg-[#141d2c] px-2 py-1.5 text-center font-mono text-sm font-semibold tabular-nums text-sky-200 outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#1b2535] pt-2.5">
              <div>
                <label
                  htmlFor="ws-rib-pitch"
                  className="block font-semibold text-slate-200"
                >
                  Khoảng cách bước gân (mm)
                </label>
                <span className="text-[10.5px] text-slate-400">
                  Mặc định {DEFAULT_WORKSHOP_SETTINGS.ribPitchMm} mm • Luôn chạy song song bích C1/C2
                </span>
              </div>
              <NumericDraftInput
                id="ws-rib-pitch"
                value={settings.ribPitchMm}
                min={80}
                max={600}
                step={10}
                ariaLabel="Khoảng cách bước gân tăng cứng (mm)"
                onCommit={(v) => patch({ ribPitchMm: v })}
                className="w-24 rounded-md border border-[#2b3b54] bg-[#141d2c] px-2 py-1.5 text-center font-mono text-sm font-semibold tabular-nums text-sky-200 outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* 2. Standard Material Sheets */}
          <div className="space-y-2.5 rounded-lg border border-[#223045] bg-[#0c121c] p-3">
            <div className="text-[10.5px] font-semibold tracking-wider text-sky-300 uppercase">
              Khổ tấm vật liệu chuẩn (Cho phép xoay 0° hoặc 90°)
            </div>

            {/* Galvanized */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-200">Tôn Mạ Kẽm (mm)</div>
                <div className="text-[10.5px] text-slate-400">
                  Mặc định {DEFAULT_WORKSHOP_SETTINGS.galvanizedSheetW} ×{' '}
                  {DEFAULT_WORKSHOP_SETTINGS.galvanizedSheetL}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <NumericDraftInput
                  id="ws-galv-w"
                  value={settings.galvanizedSheetW}
                  min={500}
                  max={3000}
                  step={50}
                  ariaLabel="Khổ rộng Tôn Mạ Kẽm (mm)"
                  onCommit={(v) => patch({ galvanizedSheetW: v })}
                  className="w-20 rounded-md border border-[#2b3b54] bg-[#141d2c] px-2 py-1.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-100 outline-none focus:border-sky-500"
                />
                <span className="font-mono text-slate-500">×</span>
                <NumericDraftInput
                  id="ws-galv-l"
                  value={settings.galvanizedSheetL}
                  min={1000}
                  max={12000}
                  step={100}
                  ariaLabel="Khổ dài Tôn Mạ Kẽm (mm)"
                  onCommit={(v) => patch({ galvanizedSheetL: v })}
                  className="w-20 rounded-md border border-[#2b3b54] bg-[#141d2c] px-2 py-1.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Inox */}
            <div className="flex items-center justify-between gap-2 border-t border-[#1b2535] pt-2.5">
              <div>
                <div className="font-semibold text-slate-200">Inox (mm)</div>
                <div className="text-[10.5px] text-slate-400">
                  Mặc định {DEFAULT_WORKSHOP_SETTINGS.inoxSheetW} ×{' '}
                  {DEFAULT_WORKSHOP_SETTINGS.inoxSheetL}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <NumericDraftInput
                  id="ws-inox-w"
                  value={settings.inoxSheetW}
                  min={500}
                  max={3000}
                  step={50}
                  ariaLabel="Khổ rộng Inox (mm)"
                  onCommit={(v) => patch({ inoxSheetW: v })}
                  className="w-20 rounded-md border border-[#2b3b54] bg-[#141d2c] px-2 py-1.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-100 outline-none focus:border-sky-500"
                />
                <span className="font-mono text-slate-500">×</span>
                <NumericDraftInput
                  id="ws-inox-l"
                  value={settings.inoxSheetL}
                  min={1000}
                  max={12000}
                  step={100}
                  ariaLabel="Khổ dài Inox (mm)"
                  onCommit={(v) => patch({ inoxSheetL: v })}
                  className="w-20 rounded-md border border-[#2b3b54] bg-[#141d2c] px-2 py-1.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#202d40] px-4 py-3">
          <button
            id="btn-reset-workshop-settings"
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a3950] bg-[#162030] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Khôi phục mặc định</span>
          </button>
          <button
            id="btn-close-workshop-settings"
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
